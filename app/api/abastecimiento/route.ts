import { NextRequest, NextResponse } from "next/server";
import { randomBytes, scryptSync } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SUPPLY_TIMEZONE,
  supplyShifts,
} from "@/services/abastecimiento/abastecimiento.service";

export async function POST(request: NextRequest) {
  const { action, payload } = await request.json();
  const supabase = createAdminClient();

  try {
    switch (action) {
      case "list-line-catalog": {
        const [lines, groups] = await Promise.all([
          supabase.from("supply_lines").select("*").order("codigo"),
          supabase.from("supply_line_groups").select("*").eq("activa", true).order("codigo_barras"),
        ]);

        return json({
          lines: unwrap(lines),
          lineGroups: unwrap(groups),
        });
      }

      case "create-line":
        return json(
          unwrap(
            await supabase
              .from("supply_lines")
              .insert({
                codigo: payload.codigo,
                nombre: payload.nombre,
                celda_id: payload.celdaId,
                activa: payload.activa,
              })
              .select("*")
              .single()
          )
        );

      case "update-line-active":
        return json(
          unwrap(
            await supabase
              .from("supply_lines")
              .update({ activa: payload.activa })
              .eq("id", payload.id)
          )
        );

      case "update-line":
        return json(
          unwrap(
            await supabase
              .from("supply_lines")
              .update({
                codigo: payload.codigo,
                nombre: payload.nombre,
                celda_id: payload.celdaId,
                activa: payload.activa,
              })
              .eq("id", payload.id)
              .select("*")
              .single()
          )
        );

      case "create-line-group":
        return json(
          unwrap(
            await supabase
              .from("supply_line_groups")
              .insert({
                codigo_barras: payload.codigoBarras,
                tienda: payload.tienda,
                lineas: payload.lineas,
                tiempo_objetivo_min: payload.tiempoObjetivoMin,
                tolerancia_rapido_min: payload.toleranciaRapidoMin,
                tolerancia_tarde_min: payload.toleranciaTardeMin,
                activa: true,
              })
              .select("*")
              .single()
          )
        );

      case "update-line-group":
        return json(
          unwrap(
            await supabase
              .from("supply_line_groups")
              .update({
                codigo_barras: payload.codigoBarras,
                tienda: payload.tienda,
                lineas: payload.lineas,
                tiempo_objetivo_min: payload.tiempoObjetivoMin,
                tolerancia_rapido_min: payload.toleranciaRapidoMin,
                tolerancia_tarde_min: payload.toleranciaTardeMin,
                activa: true,
              })
              .eq("id", payload.id)
              .select("*")
              .single()
          )
        );

      case "remove-line-group":
        return json(
          unwrap(
            await supabase
              .from("supply_line_groups")
              .update({ activa: false })
              .eq("id", payload.id)
          )
        );

      case "list-personnel":
        return json(
          unwrap(await supabase.from("supply_personnel").select("*").order("nombre"))
        );

      case "create-person":
        return json(
          unwrap(
            await supabase
              .from("supply_personnel")
              .insert({
                sap_id: payload.sapId,
                codigo_barras: payload.codigoBarras,
                nombre: payload.nombre,
                puesto: payload.puesto,
                grupo: payload.grupo,
                turno_id: payload.turnoId,
                activo: payload.activo,
              })
              .select("*")
              .single()
          )
        );

      case "update-person-active":
        return json(
          unwrap(
            await supabase
              .from("supply_personnel")
              .update({ activo: payload.activo })
              .eq("id", payload.id)
          )
        );

      case "update-person-shift":
        return json(
          unwrap(
            await supabase
              .from("supply_personnel")
              .update({ turno_id: payload.turnoId })
              .eq("id", payload.id)
          )
        );

      case "list-cells":
        return json(
          unwrap(await supabase.from("supply_cells").select("*").order("codigo"))
        );

      case "create-cell":
        return json(
          unwrap(
            await supabase
              .from("supply_cells")
              .insert({
                codigo: payload.codigo,
                nombre: payload.nombre,
                activa: payload.activa,
              })
              .select("*")
              .single()
          )
        );

      case "update-cell-active":
        return json(
          unwrap(
            await supabase
              .from("supply_cells")
              .update({ activa: payload.activa })
              .eq("id", payload.id)
          )
        );

      case "list-access-users": {
        const [users, supervisorPeople] = await Promise.all([
          supabase.from("supply_access_users").select("*").order("nombre"),
          supabase
            .from("supply_personnel")
            .select("id, grupo")
            .eq("puesto", "supervisor"),
        ]);
        const supervisorRows = unwrap(supervisorPeople) ?? [];
        const userRows = unwrap(users) ?? [];
        const peopleById = new Map(
          supervisorRows.map((person) => [person.id, person])
        );

        return json(
          userRows.map((user) => ({
            ...user,
            grupo: peopleById.get(user.id)?.grupo,
          }))
        );
      }

      case "ensure-default-admin": {
        const defaultAdmin = {
          id: "00000000-0000-0000-0000-000000000001",
          sap_id: "ADMIN",
          nombre: "Administrador SGR",
          email: buildInternalEmail("ADMIN"),
          rol: "administrador",
          activo: true,
        };
        const existingAdmin = unwrap(
          await supabase
            .from("supply_access_users")
            .select("id,password_hash")
            .eq("sap_id", defaultAdmin.sap_id)
            .maybeSingle()
        );
        const passwordHash = existingAdmin?.password_hash
          ? String(existingAdmin.password_hash)
          : hashPassword("Admin12345!");

        return json(
          unwrap(
            await supabase
              .from("supply_access_users")
              .upsert(
                {
                  ...defaultAdmin,
                  password_hash: passwordHash,
                },
                { onConflict: "sap_id" }
              )
              .select("*")
              .single()
          )
        );
      }

      case "create-access-user": {
        const authEmail = buildInternalEmail(payload.sapId);

        const user = unwrap(
          await supabase
            .from("supply_access_users")
            .upsert({
              sap_id: payload.sapId,
              nombre: payload.nombre,
              email: authEmail,
              rol: payload.rol,
              activo: payload.activo,
              password_hash: hashPassword(String(payload.password ?? "")),
            }, { onConflict: "sap_id" })
            .select("*")
              .single()
        );

        if (payload.rol === "supervisor") {
          await upsertSupervisorPersonnel(supabase, {
            accessUser: user,
            grupo: payload.grupo ?? "grupo-1",
          });
        }

        return json({
          ...user,
          grupo: payload.rol === "supervisor" ? payload.grupo ?? "grupo-1" : undefined,
        });
      }

      case "update-access-user-active":
        return json(
          unwrap(
            await supabase
              .from("supply_access_users")
              .update({ activo: payload.activo })
              .eq("id", payload.id)
          )
        );

      case "update-access-user-role": {
        const user = unwrap(
          await supabase
            .from("supply_access_users")
            .update({ rol: payload.rol })
            .eq("id", payload.id)
            .select("*")
            .single()
        );

        if (payload.rol === "supervisor") {
          await upsertSupervisorPersonnel(supabase, {
            accessUser: user,
            grupo: payload.grupo ?? "grupo-1",
          });
        }

        return json({
          ...user,
          grupo: payload.rol === "supervisor" ? payload.grupo ?? "grupo-1" : undefined,
        });
      }

      case "update-access-user-group": {
        const user = unwrap(
          await supabase
            .from("supply_access_users")
            .select("*")
            .eq("id", payload.id)
            .eq("rol", "supervisor")
            .single()
        );

        await upsertSupervisorPersonnel(supabase, {
          accessUser: user,
          grupo: payload.grupo,
        });

        return json({ ...user, grupo: payload.grupo });
      }

      case "update-access-user-password": {
        unwrap(
          await supabase
            .from("supply_access_users")
            .update({ password_hash: hashPassword(String(payload.password ?? "")) })
            .eq("id", payload.id)
        );

        return json({ ok: true });
      }

      case "resolve-access-login": {
        const user = unwrap(
          await supabase
            .from("supply_access_users")
            .select("email, activo")
            .ilike("sap_id", String(payload.sapId).trim())
            .single()
        );

        if (!user) {
          throw new Error("SAP ID no encontrado.");
        }

        if (!user.activo) {
          throw new Error("El usuario no está activo.");
        }

        return json({ email: user.email });
      }

      case "list-assignments":
        return json(
          unwrap(
            await supabase
              .from("supply_assignments")
              .select("*")
              .order("vigente_desde", { ascending: false })
          )
        );

      case "create-assignment": {
        await ensureSupervisorPersonnel(supabase, {
          supervisorId: payload.supervisorId,
          turnoId: payload.turnoId,
        });

        return json(
          unwrap(
            await supabase
              .from("supply_assignments")
              .insert({
                almacenista_id: payload.almacenistaId,
                supervisor_id: optionalId(payload.supervisorId),
                facilitador_id: optionalId(payload.facilitadorId),
                cubre_ausencia_de_id: optionalId(payload.cubreAusenciaDeId),
                turno_id: payload.turnoId,
                lineas: payload.lineas,
                tienda: payload.tienda,
                vigente_desde: payload.vigenteDesde,
                vigente_hasta: payload.vigenteHasta,
              })
              .select("*")
              .single()
          )
        );
      }

      case "close-current-assignment":
        return json(
          unwrap(
            await supabase
              .from("supply_assignments")
              .update({ vigente_hasta: payload.vigenteHasta })
              .eq("almacenista_id", payload.almacenistaId)
              .is("vigente_hasta", null)
          )
        );

      case "update-assignment-shift":
        return json(
          unwrap(
            await supabase
              .from("supply_assignments")
              .update(
                payload.supervisorId
                  ? {
                      turno_id: payload.turnoId,
                      supervisor_id: payload.supervisorId,
                    }
                  : {
                      turno_id: payload.turnoId,
                    }
              )
              .eq("id", payload.id)
          )
        );

      case "create-kiosk-run": {
        const runInsert = {
          line_group_id: payload.group.id,
          codigo_barras: payload.group.codigoBarras,
          lineas: payload.group.lineas,
          tienda: payload.group.tienda,
          tolvas: payload.tolvas,
          estado: "llenando_carro",
          tiempo_objetivo_min: payload.group.tiempoObjetivoMin,
          ...(payload.entradaAt ? { entrada_at: payload.entradaAt } : {}),
        };

        const existingOpenRun = unwrap(
          await supabase
            .from("supply_kiosk_runs")
            .select("*")
            .eq("codigo_barras", payload.group.codigoBarras)
            .neq("estado", "cerrado")
            .order("entrada_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        );

        if (existingOpenRun) {
          return json(existingOpenRun);
        }

        return json(
          unwrap(
            await supabase
              .from("supply_kiosk_runs")
              .insert(runInsert)
              .select("*")
              .single()
          )
        );
      }

      case "register-kiosk-exit":
        return json(
          unwrap(
            await supabase
              .from("supply_kiosk_runs")
              .update({
                salida_at: payload.salidaAt,
                estado: "repartiendo_tolvas",
              })
              .eq("id", payload.id)
              .select("*")
              .single()
          )
        );

      case "close-kiosk-run":
        return json(
          unwrap(
            await supabase
              .from("supply_kiosk_runs")
              .update({
                retorno_at: payload.retornoAt,
                estado: "cerrado",
                tiempo_llenado_min: payload.tiempoLlenadoMin,
                tiempo_reparto_min: payload.tiempoRepartoMin,
                tiempo_total_min: payload.tiempoTotalMin,
                cumplimiento: payload.cumplimiento,
                cierre_automatico: false,
                cierre_motivo: null,
              })
              .eq("id", payload.id)
              .select("*")
              .single()
          )
        );

      case "list-open-kiosk-runs": {
        await autoCloseExpiredKioskRuns(supabase);
        const openRuns = unwrap(
          await supabase
            .from("supply_kiosk_runs")
            .select("*")
            .neq("estado", "cerrado")
            .order("entrada_at", { ascending: false })
        );

        return json(dedupeOpenRunsByBarcode(openRuns));
      }

      case "list-closed-kiosk-runs": {
        await autoCloseExpiredKioskRuns(supabase);
        let query = supabase
          .from("supply_kiosk_runs")
          .select("*")
          .eq("estado", "cerrado")
          .order("entrada_at", { ascending: false });

        if (payload?.desde) {
          query = query.gte("entrada_at", payload.desde);
        }

        if (payload?.hasta) {
          query = query.lt("entrada_at", payload.hasta);
        }

        return json(unwrap(await query));
      }

      default:
        return NextResponse.json(
          { error: `Unsupported action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

function dedupeOpenRunsByBarcode(rows: unknown) {
  if (!Array.isArray(rows)) {
    return rows;
  }

  const seen = new Set<string>();

  return rows.filter((row) => {
    const item = row as Record<string, unknown>;
    const key = String(item.codigo_barras ?? item.line_group_id ?? item.id);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
async function autoCloseExpiredKioskRuns(
  supabase: ReturnType<typeof createAdminClient>
) {
  const now = new Date();
  const openRuns = unwrap(
    await supabase
      .from("supply_kiosk_runs")
      .select("*")
      .neq("estado", "cerrado")
      .order("entrada_at", { ascending: true })
  );

  if (!Array.isArray(openRuns) || openRuns.length === 0) {
    return;
  }

  await Promise.all(
    openRuns.map(async (run) => {
      const entradaAt = new Date(String(run.entrada_at));
      const shift = getShiftForTimestamp(entradaAt);

      if (!shift) {
        return;
      }

      const cierreAt = getShiftEndDate(entradaAt, shift.fin);

      if (now.getTime() < cierreAt.getTime()) {
        return;
      }

      const salidaAt = run.salida_at ? new Date(String(run.salida_at)) : null;
      const cierreIso = cierreAt.toISOString();
      const tiempoLlenadoMin = diffMinutes(entradaAt, salidaAt ?? cierreAt);
      const tiempoRepartoMin = salidaAt ? diffMinutes(salidaAt, cierreAt) : 0;
      const tiempoTotalMin = diffMinutes(entradaAt, cierreAt);
      const tiempoObjetivoMin = Number(run.tiempo_objetivo_min ?? 0);
      const cumplimiento = getAutoCloseStatus(tiempoTotalMin, tiempoObjetivoMin);

      unwrap(
        await supabase
          .from("supply_kiosk_runs")
          .update({
            salida_at: salidaAt ? salidaAt.toISOString() : cierreIso,
            retorno_at: cierreIso,
            estado: "cerrado",
            tiempo_llenado_min: tiempoLlenadoMin,
            tiempo_reparto_min: tiempoRepartoMin,
            tiempo_total_min: tiempoTotalMin,
            cumplimiento,
            cierre_automatico: true,
            cierre_motivo: `Sistema cerró automáticamente por fin de ${shift.nombre} (${shift.fin}).`,
          })
          .eq("id", run.id)
          .neq("estado", "cerrado")
      );
    })
  );
}

function getShiftForTimestamp(date: Date) {
  const localMinutes = getLocalMinutes(date);
  return supplyShifts.find((shift) => {
    const start = timeToMinutes(shift.inicio);
    const end = timeToMinutes(shift.fin);
    return localMinutes >= start && localMinutes <= end;
  });
}

function getShiftEndDate(referenceDate: Date, endTime: string) {
  const localDate = getLocalDateParts(referenceDate);
  return new Date(`${localDate.year}-${localDate.month}-${localDate.day}T${endTime}:00-06:00`);
}

function getLocalMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SUPPLY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function getLocalDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SUPPLY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: parts.find((part) => part.type === "year")?.value ?? "1970",
    month: parts.find((part) => part.type === "month")?.value ?? "01",
    day: parts.find((part) => part.type === "day")?.value ?? "01",
  };
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function diffMinutes(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

function getAutoCloseStatus(tiempoTotalMin: number, tiempoObjetivoMin: number) {
  if (tiempoObjetivoMin <= 0) {
    return "en_rango";
  }

  if (tiempoTotalMin > tiempoObjetivoMin) {
    return "tarde";
  }

  return "en_rango";
}
function unwrap<T>({ data, error }: { data: T; error: unknown }) {
  if (error) {
    throw error;
  }

  return data;
}

function json(data: unknown) {
  return NextResponse.json({ data });
}

function optionalId(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

async function ensureSupervisorPersonnel(
  supabase: ReturnType<typeof createAdminClient>,
  input: { supervisorId?: string; turnoId?: string }
) {
  const supervisorId = optionalId(input.supervisorId);

  if (!supervisorId) {
    return;
  }

  const accessUser = unwrap(
    await supabase
      .from("supply_access_users")
      .select("*")
      .eq("id", supervisorId)
      .eq("rol", "supervisor")
      .maybeSingle()
  );

  if (!accessUser) {
    return;
  }

  const existingSupervisor = unwrap(
    await supabase
      .from("supply_personnel")
      .select("grupo, turno_id")
      .eq("id", accessUser.id)
      .maybeSingle()
  );

  await upsertSupervisorPersonnel(supabase, {
    accessUser,
    grupo: existingSupervisor?.grupo ?? "grupo-1",
    turnoId: input.turnoId ?? existingSupervisor?.turno_id ?? "turno-a",
  });
}

async function upsertSupervisorPersonnel(
  supabase: ReturnType<typeof createAdminClient>,
  input: {
    accessUser: Record<string, unknown>;
    grupo: string;
    turnoId?: string;
  }
) {
  unwrap(
    await supabase.from("supply_personnel").upsert(
      {
        id: input.accessUser.id,
        sap_id: input.accessUser.sap_id,
        codigo_barras: input.accessUser.sap_id,
        nombre: input.accessUser.nombre,
        puesto: "supervisor",
        grupo: input.grupo,
        turno_id: input.turnoId ?? "turno-a",
        activo: input.accessUser.activo,
      },
      { onConflict: "id" }
    )
  );
}

function buildInternalEmail(sapId: string) {
  return `${String(sapId).trim().toLowerCase()}@sgr.local.com`;
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const details = error as {
      message?: unknown;
      name?: unknown;
      code?: unknown;
      status?: unknown;
      error?: unknown;
      error_description?: unknown;
    };
    const message =
      details.message ??
      details.error_description ??
      details.error ??
      [
        details.name ? `name=${String(details.name)}` : "",
        details.code ? `code=${String(details.code)}` : "",
        details.status ? `status=${String(details.status)}` : "",
      ]
        .filter(Boolean)
        .join(" ");

    if (message) {
      return String(message);
    }

    try {
      const json = JSON.stringify(error);
      return json && json !== "{}"
        ? json
        : "Supabase Auth devolvio un error sin detalle. Revise SUPABASE_SECRET_KEY y politicas de Auth.";
    } catch {
      return Object.prototype.toString.call(error);
    }
  }

  return String(error);
}



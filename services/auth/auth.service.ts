interface AuthUser {
  id: string;
  email: string;
  user_metadata?: {
    sap_id?: string;
    nombre?: string;
    rol?: string;
  };
}

interface AuthResponse {
  data: {
    user: AuthUser | null;
  };
  error?: {
    message: string;
  } | null;
}

export async function login(email: string, password: string) {
  return await loginWithSapId(email, password);
}

export async function loginWithSapId(
  sapId: string,
  password: string
): Promise<AuthResponse> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ sapId: sapId.trim(), password }),
  });

  const result = (await response.json()) as AuthResponse & { error?: string };

  if (!response.ok) {
    return {
      data: { user: null },
      error: {
        message:
          typeof result.error === "string"
            ? result.error
            : "No se pudo iniciar sesion.",
      },
    };
  }

  return {
    data: result.data,
    error: null,
  };
}

export async function logout() {
  await fetch("/api/auth/session", {
    method: "DELETE",
  });
}

export async function getCurrentUser(): Promise<AuthResponse> {
  const response = await fetch("/api/auth/session", {
    method: "GET",
  });

  if (!response.ok) {
    return {
      data: { user: null },
      error: {
        message: "No se pudo leer la sesion actual.",
      },
    };
  }

  const result = (await response.json()) as AuthResponse;
  return {
    data: result.data,
    error: null,
  };
}

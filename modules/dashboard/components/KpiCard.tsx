"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";

interface Props {
  title: string;
  value: string | number;
}

export default function KpiCard({ title, value }: Props) {
  return (
    <Card
      elevation={2}
      sx={{
        height: "100%",
        borderRadius: 3,
      }}
    >
      <CardContent>
        <Typography
          variant="body2"
          component="p"
          color="text.secondary"
          sx={{ mb: 1 }}
        >
          {title}
        </Typography>

        <Typography
          variant="h4"
          component="h2"
          sx={{
            fontWeight: 700,
          }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}
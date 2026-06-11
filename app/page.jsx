import Landing from "./_landing/Landing";

export const metadata = {
  title: "Wefty — Deja de adivinar cuánto stock pedir",
  description:
    "Wefty predice cuántas unidades producir de cada producto, talla y color — incluso de los que aún no has lanzado. Funciona con un simple CSV de ventas.",
  openGraph: {
    title: "Wefty — Deja de adivinar cuánto stock pedir",
    description:
      "Predicción de stock para marcas de moda que venden online. Tu pedido óptimo por talla y color, con un simple CSV de ventas.",
    locale: "es_ES",
    type: "website",
    siteName: "Wefty",
  },
};

export default function Page() {
  return <Landing />;
}

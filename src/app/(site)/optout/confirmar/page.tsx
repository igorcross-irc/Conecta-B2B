import { connection } from "next/server";
import { ConfirmarOptOut } from "./ConfirmarOptOut";

export const metadata = { title: "Confirmar pedido" };

export default async function Confirmar({ searchParams }: PageProps<"/optout/confirmar">) {
  await connection();
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  return <ConfirmarOptOut token={token} />;
}

import { redirect } from "next/navigation";

/** Las misiones ahora son actividades de cada proyecto. */
export default function MissionsPage() {
  redirect("/proyectos");
}

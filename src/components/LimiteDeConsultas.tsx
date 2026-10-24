/** Mostrado no lugar de uma tela de consulta pesada quando o usuário passou da cota por hora. */
export function LimiteDeConsultas() {
  return (
    <div className="vazio" role="alert">
      <p className="font-medium text-tinta">Muitas consultas em pouco tempo</p>
      <p>Para proteger a base, cada pessoa pode fazer até 600 consultas por hora. Espere alguns minutos e tente de novo.</p>
    </div>
  );
}

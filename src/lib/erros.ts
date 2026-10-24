/** Erro previsto de regra de negócio, com o status HTTP que a rota deve devolver. */
export class ErroDeNegocio extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ErroDeNegocio";
  }
}

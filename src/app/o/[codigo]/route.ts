// Link curto usado no WhatsApp: o id sem hífens não é confundido com chave Pix aleatória.
const CODIGO = /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i;

export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const partes = CODIGO.exec(codigo);
  const destino = partes ? `/oferta/${partes.slice(1).join("-").toLowerCase()}` : "/site/radar";
  return Response.redirect(new URL(destino, request.url), 308);
}

const PERGUNTAS = [
  {
    pergunta: "Como o Radar de ofertas funciona?",
    resposta: "O Radar monitora rotas de voo continuamente e mostra as passagens com o maior desconto em relação ao preço normal daquele trecho.",
  },
  {
    pergunta: "Preciso ser membro para ver as ofertas?",
    resposta: "Não. Qualquer pessoa pode navegar pelo Radar e ver as oportunidades. Para comprar a passagem com o benefício do Vaiviajar, é preciso ter acesso de membro.",
  },
  {
    pergunta: "Como acompanho uma passagem?",
    resposta: "Ao buscar uma rota, defina o preço máximo que você quer pagar. Assim que uma passagem aparecer dentro desse valor, você recebe um alerta.",
  },
  {
    pergunta: "Como recebo as notificações?",
    resposta: "As notificações aparecem no sininho no topo da tela. Se você instalar o Vaiviajar como app, também pode ativar notificações do navegador.",
  },
  {
    pergunta: "Posso acompanhar mais de uma rota?",
    resposta: "Sim. Não há limite de passagens que você pode acompanhar ao mesmo tempo.",
  },
];

export default function SiteAjuda() {
  return (
    <div className="px-5 py-8 sm:px-8 lg:py-10">
      <p className="text-xs font-black uppercase tracking-widest text-blue-600">Ajuda</p>
      <h1 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">Como podemos ajudar?</h1>

      <div className="mt-8 space-y-3">
        {PERGUNTAS.map((item) => (
          <details key={item.pergunta} className="group rounded-2xl border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer list-none text-sm font-black text-slate-900 marker:content-none">
              {item.pergunta}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.resposta}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

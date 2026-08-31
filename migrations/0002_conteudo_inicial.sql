-- Conteúdo inicial: as 5 equipes e um texto base em cada página.
-- Tudo isso é editável pelo próprio site (modo edição com PIN) — é só um ponto de partida.

DELETE FROM blocos;
DELETE FROM equipes;

INSERT INTO equipes (id, nome, resumo, ordem) VALUES
  ('camera-central', 'Câmera Central', 'Plano principal e fixo do palco.', 1),
  ('camera-movel',   'Câmera Móvel',   'Plano de apoio, ombro e movimentação pela nave.', 2),
  ('grua',           'Grua',           'Planos altos e movimentos de abertura.', 3),
  ('corte',          'Corte',          'Switcher: decide o que vai ao ar.', 4),
  ('computador',     'Computador',     'Slides, letras, vídeos e transmissão online.', 5);

INSERT INTO blocos (pagina, titulo, corpo, ordem) VALUES
('equipe:camera-central', 'O que essa função faz',
'A **câmera central** entrega o plano principal da transmissão. É o enquadramento que fica no ar na maior parte do tempo, então estabilidade e consistência valem mais do que movimento.

- Plano padrão: **meio-primeiro plano** do pregador, com um pouco de espaço acima da cabeça.
- Sem zoom brusco. Se precisar corrigir enquadramento, faça devagar.
- Acompanhe quem está falando, mas não persiga: deixe a pessoa se mover dentro do quadro.
- Fique atento ao retorno do corte para saber quando você está no ar.', 1),

('equipe:camera-central', 'Checklist antes de começar',
'1. Câmera ligada, bateria carregada e cabo de energia conectado.
2. Cartão de memória com espaço, se estiver gravando local.
3. Cabo de vídeo conectado e imagem chegando no switcher.
4. Balanço de branco batendo com as outras câmeras.
5. Tripé travado e nivelado.', 2),

('equipe:camera-movel', 'O que essa função faz',
'A **câmera móvel** é o respiro da transmissão: detalhes, reações da congregação, músicos, plano aberto lateral.

- Busque planos que a central não consegue: mãos no instrumento, rosto de quem canta, plano geral do salão.
- Antes de andar, verifique o cabo. Nunca cruze a frente da câmera central.
- Segure cada enquadramento por pelo menos **5 segundos** parado antes de mudar.
- Movimento só com propósito. Câmera tremendo cansa quem assiste.', 1),

('equipe:camera-movel', 'Checklist antes de começar',
'1. Bateria cheia e bateria reserva no bolso.
2. Cabo com folga suficiente para o trajeto que você vai fazer.
3. Combinar com o corte os pontos onde você vai se posicionar.
4. Monopé ou estabilizador ajustado na sua altura.', 2),

('equipe:grua', 'O que essa função faz',
'A **grua** entrega os planos de abertura e os movimentos que dão escala ao ambiente.

- Use com parcimônia: normalmente na abertura, no louvor e no encerramento.
- Movimento lento e contínuo. Comece e termine com o plano parado.
- Sempre avise o corte antes de iniciar um movimento.
- Atenção à área de segurança: ninguém passa por baixo do braço em movimento.', 1),

('equipe:grua', 'Segurança',
'> A grua é o equipamento com maior risco físico da equipe. Nada aqui é opcional.

- Confira o contrapeso antes de cada uso.
- Trave o braço quando não estiver operando.
- Não faça montagem nem desmontagem sozinho.
- Se algo parecer folgado, pare e chame o responsável.', 2),

('equipe:corte', 'O que essa função faz',
'O **corte** decide o que a igreja em casa está vendo. É a função que amarra todas as outras.

- Corte no tempo da música e da fala, não no impulso.
- Prepare a próxima câmera no preview antes de cortar.
- Evite ficar mais de 15 a 20 segundos no mesmo plano em momentos dinâmicos.
- Fale com as câmeras pelo intercom com antecedência: peça o plano antes de precisar dele.', 1),

('equipe:corte', 'Checklist antes de começar',
'1. Todas as fontes de vídeo chegando e identificadas no switcher.
2. Intercom testado com cada câmera, uma por uma.
3. Vinhetas e artes carregadas na ordem do culto.
4. Gravação do programa iniciada.', 2),

('equipe:computador', 'O que essa função faz',
'O **computador** cuida de tudo que é gráfico e do envio da transmissão: letras, slides, versículos, vídeos e o streaming.

- Receba a lista de músicas e a referência da pregação antes do culto.
- Confira a letra completa de cada música, incluindo repetições.
- Suba a letra no tempo da banda, um pouco antes de a frase começar.
- Fique de olho no indicador de streaming durante todo o culto.', 1),

('equipe:computador', 'Checklist antes de começar',
'1. Internet testada — cabo, não Wi-Fi, sempre que possível.
2. Software de transmissão aberto e conectado com a plataforma.
3. Bitrate e resolução conferidos.
4. Slides e vídeos do dia carregados e testados com áudio.
5. Transmissão agendada e link publicado nas redes.', 2),

('instrucoes', 'Antes do culto',
'Chegue com **1 hora de antecedência**. O tempo antes do culto é o que evita problema durante.

1. Ligue e teste todos os equipamentos da sua função.
2. Confira o intercom com a mesa de corte.
3. Alinhe cor e exposição entre as câmeras.
4. Verifique o áudio que está entrando na transmissão.
5. Confirme com o líder a ordem do culto e mudanças de última hora.', 1),

('instrucoes', 'Durante o culto',
'- Silêncio no intercom, exceto para o que é da operação.
- Celular no silencioso e longe do enquadramento.
- Se algo der errado, **avise no intercom em vez de tentar resolver sozinho**.
- Nunca desligue nada sem confirmar com o corte.
- Roupa neutra e discreta, principalmente para quem circula pela nave.', 2),

('instrucoes', 'Depois do culto',
'1. Encerre a transmissão e confirme que a gravação foi salva.
2. Faça backup do material bruto no destino combinado.
3. Desligue os equipamentos na ordem: câmeras, switcher, computador.
4. Guarde os cabos enrolados corretamente e tudo no lugar de origem.
5. Anote no grupo qualquer defeito ou item faltando.', 3),

('instrucoes', 'Combinados da equipe',
'- Se não puder vir na data em que está escalado, **avise com pelo menos 48 horas** e ajude a encontrar substituto.
- Quem está escalado confirma presença no grupo até a sexta-feira.
- Dúvida sobre a função? Pergunte antes do culto, não durante.
- Todo mundo ajuda na montagem e na desmontagem, independente da função.', 4);

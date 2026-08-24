/* =========================================================================
   motion.js — reforço de movimento com GSAP (Clínica Médica Dr. Cid Cury)

   Este arquivo NÃO substitui a revelação por rolagem que já existe no
   <script> inline do index.html (menu, sombra do cabeçalho, revelação por
   IntersectionObserver, carrossel, mapa) — aquele sistema já é suave,
   acessível e testado, e refazê-lo em GSAP não mudaria nada visível.
   Aqui entra só o que é NOVO:
     1. Paralaxe leve da fachada do hero ao rolar.
     2. Botão do WhatsApp do hero com atração magnética sutil ao ponteiro.
     3. Tilt 3D discreto nos cards de Tratamentos e nos depoimentos.

   Mesmo guard do resto do site: só roda com js-mov (JS ligado e sem
   prefers-reduced-motion). Efeitos de ponteiro (magnético/tilt) exigem
   também um dispositivo com mouse de verdade — não fazem sentido no toque. */

(function () {
  'use strict';

  var raiz = document.documentElement;
  if (!raiz.classList.contains('js-mov')) return;
  if (typeof window.gsap === 'undefined') return; // vendor não carregou

  var gsap = window.gsap;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  var finoAponta = !!(window.matchMedia && matchMedia('(pointer: fine)').matches);

  // ---------------------------------------------------------------------
  // 1. Paralaxe da fachada do hero
  //    A fachada é um ::before (pseudo-elemento, não dá para animar
  //    diretamente); ele lê a variável --parallax-y no CSS
  //    (transform: scale(1.06) translateY(var(--parallax-y, 0px))),
  //    então aqui só escrevemos essa variável conforme a rolagem.
  // ---------------------------------------------------------------------
  (function paralaxeHero() {
    var hero = document.querySelector('.hero');
    if (!hero || !window.ScrollTrigger) return;

    var estado = { y: 0 };
    gsap.to(estado, {
      y: 46,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.4
      },
      onUpdate: function () {
        hero.style.setProperty('--parallax-y', estado.y + 'px');
      }
    });
  })();

  // ---------------------------------------------------------------------
  // 2. CTA magnético — só o botão principal do hero, só com mouse.
  //    Puxa poucos px em direção ao ponteiro quando ele está perto;
  //    volta ao lugar com uma mola suave ao afastar/sair.
  // ---------------------------------------------------------------------
  function ligarMagnetico(el) {
    if (!el) return;
    var FORCA = 0.12;  // puxão bem curto: o botão acompanha, não persegue
    var MAX = 5;       // deslocamento máximo, em px
    var FOLGA = 44;    // px além da borda do botão em que já reage

    // Duração maior + power2.out: o botão desliza e assenta, em vez de
    // acompanhar o ponteiro quadro a quadro (o que lia como "agitado").
    var mx = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power2.out' });
    var my = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power2.out' });

    function aoMover(e) {
      var r = el.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2);
      var dy = e.clientY - (r.top + r.height / 2);

      // Zona de reação ELÍPTICA, colada à forma do botão. Com um raio
      // circular (o que havia antes), um botão largo e baixo reagia a um
      // ponteiro muito acima ou abaixo dele — parecia mexer sozinho.
      var nx = dx / (r.width / 2 + FOLGA);
      var ny = dy / (r.height / 2 + FOLGA);
      var d = Math.hypot(nx, ny);
      if (d > 1) { mx(0); my(0); return; }

      // Desvanece até zero na borda da zona: sem degrau ao entrar e sair.
      var fade = 1 - d;
      var ox = dx * FORCA * fade;
      var oy = dy * FORCA * fade;

      // O teto é aplicado ao VETOR, não a cada eixo em separado. Limitar x e
      // y independentemente (o bug anterior) TORCE a direção: com o ponteiro
      // na diagonal, um eixo saturava antes do outro e o botão saía numa
      // direção que não era a do ponteiro — daí a sensação de bagunça.
      var m = Math.hypot(ox, oy);
      if (m > MAX) { ox = ox / m * MAX; oy = oy / m * MAX; }

      mx(ox); my(oy);
    }

    window.addEventListener('pointermove', aoMover, { passive: true });
    el.addEventListener('pointerleave', function () { mx(0); my(0); });
  }

  // ---------------------------------------------------------------------
  // 3. Tilt 3D discreto — cards de Tratamentos e depoimentos.
  //    Rotação segue a posição do ponteiro dentro do card; some ao sair.
  //    Amplitude pequena de propósito: é uma clínica médica, não um jogo.
  // ---------------------------------------------------------------------
  // A peça aproxima de leve ao receber o ponteiro e inclina seguindo ele.
  //
  // Rotação e escala usam ferramentas DIFERENTES de propósito:
  //
  // - A rotação muda a cada quadro (persegue o ponteiro) → `quickTo`, que é
  //   feito exatamente para isso: reaproveita um tween só, sem criar objeto
  //   novo a cada movimento do mouse.
  //
  // - A escala muda duas vezes por hover (entra / sai) → um `gsap.to()`
  //   comum. Aqui havia um `quickTo(el, 'scale', ...)` que NUNCA funcionou:
  //   `scale` é atalho para scaleX/scaleY, e o quickTo não aceita atalho —
  //   o GSAP recusava com "scale not eligible for reset" a cada hover, sem
  //   efeito nenhum. O `gsap.to()` aceita o atalho e resolve.
  //
  // `overwrite: 'auto'` faz o tween novo matar só o tween de escala anterior
  // (entra e sai rápido não empilha), e não toca na rotação: o overwrite do
  // GSAP é por propriedade, e estas não se cruzam.
  function ligarTilt(el, amplitudeGraus, escalaHover) {
    if (!el) return;
    var MAX = amplitudeGraus || 5;
    var ESC = escalaHover || 1.015;   // ~5px num card de 355px: acabamento

    el.classList.add('tem-tilt');
    gsap.set(el, { transformPerspective: 900, transformOrigin: 'center' });

    var rx = gsap.quickTo(el, 'rotationX', { duration: 0.45, ease: 'power3' });
    var ry = gsap.quickTo(el, 'rotationY', { duration: 0.45, ease: 'power3' });

    function escalar(v) {
      gsap.to(el, { scale: v, duration: 0.35, ease: 'power3', overwrite: 'auto' });
    }

    el.addEventListener('pointerenter', function () { escalar(ESC); });
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      ry(px * MAX);
      rx(-py * MAX);
    });
    el.addEventListener('pointerleave', function () {
      rx(0); ry(0); escalar(1);
    });
  }

  if (finoAponta) {
    ligarMagnetico(document.querySelector('.hero-actions .btn-whatsapp'));

    Array.prototype.forEach.call(document.querySelectorAll('.card'), function (el) {
      ligarTilt(el, 5);
    });
    // Escala menor que a dos cards, e por um motivo concreto: o depoimento
    // vive dentro do carrossel, que é `overflow-x: auto` e só tem 4px de
    // padding de folga. Medido a 600px de janela: com 1.015 o card cresce
    // ~4px para cada lado e encosta na borda do trilho (folga 0) — mais um
    // fio e passa a ser cortado. Com 1.008 sobra folga em qualquer largura.
    // O card de Tratamentos não tem esse limite: está numa grade comum.
    Array.prototype.forEach.call(document.querySelectorAll('.depoimento'), function (el) {
      ligarTilt(el, 4, 1.008);
    });

    // O bloco "Seu tratamento é baseado em" JÁ TEVE tilt aqui e foi tirado.
    // Mesmo reduzido a ~2° (calibrado para dar o mesmo deslocamento de canto
    // de um card), inclinar uma superfície de ~1096x605 fica estranho: card é
    // objeto, um painel dessa largura lê como a própria página entortando.
    // A vida desse bloco vem do hover linha a linha, em CSS (`.pilar:hover`
    // no styles.css) — o realce acontece onde o olho está, sem mover a peça
    // inteira. NÃO reintroduzir tilt aqui.
  }
})();

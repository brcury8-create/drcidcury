/* =========================================================================
   tratamentos.js — movimento da seção "Tratamentos"

   A seção explica o processo de atendimento (3 etapas + 5 pilares) e é uma
   das mais importantes do site. O movimento aqui serve para SUBLINHAR a
   informação, nunca para competir com ela — clínica médica, tom sóbrio.

   Três peças:
     1. Ícones dos pilares que desenham as próprias linhas ao entrar na tela.
     2. Entrada escalonada dos blocos da seção.
     3. Paralaxe curta no bloco de pilares.

   Houve uma quarta: uma linha ligando os numerais 1 → 2 → 3. Foi removida
   depois de vista no navegador — um traço fino atravessando área vazia lia
   como ruído, não como ligação. A sequência já é dada pelos próprios
   numerais e pela entrada escalonada. NÃO reintroduzir sem repensar a forma.

   O hover dos pilares e o tilt do bloco NÃO estão aqui: são CSS puro e
   assets/motion.js, respectivamente (ver `ligarTilt`).

   Nada aqui carrega biblioteca nova: GSAP e ScrollTrigger já vêm para o
   motion.js. Custo de rede desta seção: zero.

   TUDO É ADITIVO. O estado escondido é aplicado por JS (gsap.set/from), e
   NÃO por CSS. Se este arquivo não rodar — sem JS, sem GSAP, ou com
   prefers-reduced-motion — a seção aparece inteira e estática, como antes.
   Este é o motivo de os blocos daqui terem saído do `data-revelar`.
   ========================================================================= */

(function () {
  'use strict';

  var raiz = document.documentElement;
  if (!raiz.classList.contains('js-mov')) return;      // exclui reduced-motion
  if (typeof window.gsap === 'undefined') return;
  if (typeof window.ScrollTrigger === 'undefined') return;

  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);

  var secao = document.getElementById('tratamentos');
  if (!secao) return;

  var DIST = 16;          // deslocamento de entrada, em px — curto de propósito
  var DUR = 0.55;

  // =======================================================================
  // 1. Ícones dos pilares que se desenham
  //    Os ícones já são de traço (fill:none + stroke), e todos os elementos
  //    são <path> — por isso dá para tratar os 16 do mesmo jeito, sem
  //    exceção para <circle>/<rect>.
  // =======================================================================
  (function iconesQueSeDesenham() {
    var icones = secao.querySelectorAll('.pilar-icone');
    if (!icones.length) return;

    Array.prototype.forEach.call(icones, function (icone) {
      var paths = icone.querySelectorAll('path');
      if (!paths.length) return;

      var comprimentos = [];
      var ok = true;

      Array.prototype.forEach.call(paths, function (p) {
        var len = 0;
        try { len = p.getTotalLength(); } catch (e) { ok = false; }
        // Path sem comprimento mensurável (ou navegador que devolve 0):
        // não desenha, para não deixar a linha escondida para sempre.
        if (!len || !isFinite(len)) ok = false;
        comprimentos.push(len);
      });
      if (!ok) return;

      Array.prototype.forEach.call(paths, function (p, i) {
        var len = comprimentos[i];
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      });

      gsap.to(paths, {
        strokeDashoffset: 0,
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.08,
        scrollTrigger: {
          trigger: icone.closest('.pilar') || icone,
          start: 'top 88%',
          once: true                     // desenha uma vez e para de custar
        },
        // Tira o dasharray no fim: deixar o traço fatiado atrapalha se a
        // pessoa mudar o zoom depois (o comprimento muda, o dash não).
        onComplete: function () {
          Array.prototype.forEach.call(paths, function (p) {
            p.style.strokeDasharray = 'none';
            p.style.strokeDashoffset = '0';
          });
        }
      });
    });
  })();

  // =======================================================================
  // 2. Entrada escalonada dos blocos
  // =======================================================================
  (function entrada() {
    function surgir(alvos, opcoes) {
      if (!alvos || (alvos.length === 0)) return;
      opcoes = opcoes || {};
      gsap.from(alvos, {
        opacity: 0,
        y: opcoes.y !== undefined ? opcoes.y : DIST,
        duration: DUR,
        ease: 'power2.out',
        stagger: opcoes.stagger || 0.09,
        scrollTrigger: {
          trigger: opcoes.trigger || alvos[0] || alvos,
          start: 'top 88%',
          once: true
        },
        onStart: opcoes.onStart
      });
    }

    // Cabeçalho da seção
    var cabecalho = secao.querySelectorAll('.section-kicker, .section-title, .section-lead');
    surgir(cabecalho, { trigger: cabecalho[0] });

    // Os três cards das etapas. Ao entrar, cada card recebe `is-visivel` —
    // é essa classe que dispara o `mov-numero` do CSS, a batidinha do
    // numeral que já existia antes desta mudança. Reaproveitado, não refeito.
    var cards = secao.querySelectorAll('.card');
    if (cards.length) {
      gsap.from(cards, {
        opacity: 0,
        y: DIST + 6,
        duration: DUR,
        ease: 'power2.out',
        stagger: 0.12,
        scrollTrigger: { trigger: secao.querySelector('.cards') || cards[0], start: 'top 85%', once: true },
        onStart: function () {
          Array.prototype.forEach.call(cards, function (c, i) {
            // O atraso acompanha o stagger, para o numeral bater junto
            // com o card a que pertence.
            setTimeout(function () { c.classList.add('is-visivel'); }, i * 120);
          });
        }
      });
    }

    // Bloco de pilares: SÓ opacidade. O `y` fica reservado para a paralaxe
    // (item 4) — animar `y` aqui também faria os dois brigarem pelo mesmo
    // canal de transform.
    var bloco = secao.querySelector('.pilares-bloco');
    if (bloco) {
      gsap.from(bloco, {
        opacity: 0,
        duration: 0.6,
        ease: 'power1.out',
        scrollTrigger: { trigger: bloco, start: 'top 88%', once: true }
      });
      // As linhas por dentro entram escalonadas, o que dá ritmo à leitura
      // sem precisar mexer no `y` do bloco.
      var pilares = bloco.querySelectorAll('.pilar');
      if (pilares.length) {
        gsap.from(pilares, {
          opacity: 0,
          y: DIST,
          duration: DUR,
          ease: 'power2.out',
          stagger: 0.07,
          scrollTrigger: { trigger: bloco, start: 'top 82%', once: true }
        });
      }
    }

    // Aviso e botão fecham a seção
    var fecho = secao.querySelectorAll('.disclaimer, .section-actions');
    surgir(fecho, { trigger: fecho[0], stagger: 0.1 });
  })();

  // =======================================================================
  // 3. Paralaxe curta no bloco de pilares
  //    Só `y`, e só neste bloco — a entrada dele acima usa apenas opacidade
  //    justamente para não disputar este canal.
  // =======================================================================
  (function paralaxeDosPilares() {
    var bloco = secao.querySelector('.pilares-bloco');
    if (!bloco) return;

    gsap.fromTo(bloco,
      { y: 16 },
      {
        y: -16,
        ease: 'none',
        scrollTrigger: {
          trigger: bloco,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6
        }
      }
    );
  })();

})();

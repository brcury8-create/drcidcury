/* =========================================================================
   hero3d.js — cena 3D do hero (Clínica Médica Dr. Cid Cury)

   Puramente ADITIVO. Se qualquer coisa falhar (sem WebGL, sem js-mov,
   prefers-reduced-motion, erro ao carregar), a função sai em silêncio e o
   hero continua sendo exatamente o de hoje: a <img class="hero-logo"> do DOM
   permanece visível como fallback garantido.

   O que desenha:
   - Marca 3D: o logo.svg extrudado (coração vermelho, cruz branca, faixa
     azul), posicionado EXATAMENTE sobre o slot da .hero-logo do DOM — a
     posição é lida do getBoundingClientRect do próprio <img>, então alinha
     em todos os breakpoints e no resize.
     (Profundidade ambiente com orbs foi tentada e removida: sobre a foto
     de baixa resolução da fachada, o gradiente radial + additive blending
     bandeava — ficava com cara de "spot de luz" granulado. Só a marca.)

   LGPD: three e SVGLoader são self-hosted em assets/vendor. Zero rede externa.
   ========================================================================= */

import * as THREE from 'three';
import { SVGLoader } from './vendor/three/SVGLoader.js';

(function () {
  'use strict';

  var raiz = document.documentElement;

  // Mesmo guard do resto do site: js-mov só existe se há JS e o visitante NÃO
  // pediu movimento reduzido. Sem isso, nada de 3D.
  if (!raiz.classList.contains('js-mov')) return;

  var hero = document.querySelector('.hero');
  var slot = document.querySelector('.hero-logo'); // referência de posição/escala
  if (!hero || !slot) return;

  // WebGL disponível? Se não, cai no fallback estático.
  function temWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  if (!temWebGL()) return;

  // --- Canvas dedicado, criado por JS (não fica no HTML: se o JS não roda,
  //     não há canvas vazio na página). Fica atrás do conteúdo do hero. ---
  var canvas = document.createElement('canvas');
  canvas.className = 'hero-3d';
  canvas.setAttribute('aria-hidden', 'true');
  hero.insertBefore(canvas, hero.firstChild);

  var largura = 1, altura = 1;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,            // fundo transparente: o scrim/fachada aparecem
      antialias: true,
      powerPreference: 'low-power'
    });
  } catch (e) {
    canvas.remove();
    return;
  }

  var DPR_MAX = 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_MAX));

  var scene = new THREE.Scene();

  // Câmera perspectiva olhando de frente para o plano z=0, onde vive a marca.
  var FOV = 45;
  var DIST = 220;
  var camera = new THREE.PerspectiveCamera(FOV, 1, 1, 2000);
  camera.position.set(0, 0, DIST);

  // SEM LUZES, de propósito — a cena inteira usa MeshBasicMaterial.
  //
  // Com material PBR + luz direcional aparecia um "coração menor" desenhado
  // dentro do coração: o sombreado variava ao longo da borda da extrusão e
  // marcava um contorno fechado acompanhando todo o perfil da peça. O mesmo
  // sombreado também impedia o branco da cruz de chegar a branco de verdade,
  // deixando o logo apagado ao lado do texto #FFF do hero.
  //
  // Trocado por cor chapada: a face recebe a cor EXATA da marca e a parede
  // lateral uma versão escurecida (ver materiais abaixo). O volume vem da
  // diferença entre face e lateral, não de iluminação — resultado limpo,
  // previsível e com a cor da marca intacta.

  // ---------------------------------------------------------------------
  // Marca 3D: extruda o logo.svg preservando as cores dos preenchimentos.
  // ---------------------------------------------------------------------
  var marca = new THREE.Group();     // contém as peças extrudadas do logo
  var marcaPronta = false;
  var LOGO_VB = 100;                 // viewBox do logo.svg é 100x100
  var alturaIntrinseca = LOGO_VB;    // altura da marca em unidades do SVG

  // Pivô que recebe rotação idle + parallax; a marca centrada mora dentro.
  var pivo = new THREE.Group();
  scene.add(pivo);

  var loader = new SVGLoader();
  loader.load('assets/logo.svg', function (data) {
    var paths = data.paths;
    // Ordem de desenho = ordem no SVG (coração, cruz, faixas). Um leve
    // degrau em z evita z-fighting entre preenchimentos coplanares e dá
    // um relevo sutil (cruz e faixa ligeiramente à frente do coração).
    var passoZ = 0.9;

    for (var p = 0; p < paths.length; p++) {
      var path = paths[p];
      var cor = path.color; // THREE.Color do fill (SVGLoader já trata sRGB)

      // ExtrudeGeometry separa a geometria em dois grupos de material:
      // grupo 0 = tampas (frente e verso), grupo 1 = paredes laterais.
      // Isso permite dar à face a cor exata da marca e à lateral uma versão
      // escurecida — o que cria a leitura de volume sem nenhuma luz.
      var matFace = new THREE.MeshBasicMaterial({
        color: cor,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -p,
        polygonOffsetUnits: -1
      });
      var matLateral = new THREE.MeshBasicMaterial({
        color: cor.clone().multiplyScalar(0.62),
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -p,
        polygonOffsetUnits: -1
      });
      var material = [matFace, matLateral];

      var shapes = path.toShapes();
      for (var s2 = 0; s2 < shapes.length; s2++) {
        // Sem bevel: o chanfro só acrescentava mais um anel na borda.
        // A profundidade pode ser um pouco maior agora que a lateral tem cor
        // própria — é ela que dá o volume, e sem luz não há artefato.
        var geo = new THREE.ExtrudeGeometry(shapes[s2], {
          depth: 3.5,
          bevelEnabled: false,
          curveSegments: 18
        });
        var mesh = new THREE.Mesh(geo, material);
        mesh.position.z = p * passoZ;
        marca.add(mesh);
      }
    }

    // O SVG tem Y para baixo; o mundo 3D tem Y para cima. Espelha em Y.
    marca.scale.y = -1;

    // Centraliza: desloca a marca para que o seu centro caia na origem do
    // pivô, que é quem recebe rotação/parallax (gira em torno do centro).
    var box = new THREE.Box3().setFromObject(marca);
    var centro = box.getCenter(new THREE.Vector3());
    var tam = box.getSize(new THREE.Vector3());
    alturaIntrinseca = tam.y || LOGO_VB;
    marca.position.x = -centro.x;
    marca.position.y = -centro.y;
    pivo.add(marca);

    marcaPronta = true;
    posicionarMarca();
    hero.classList.add('is-3d'); // esconde a .hero-logo do DOM via CSS
  }, undefined, function () {
    // Falha ao carregar o SVG: mantém o fallback, remove o canvas.
    limpar();
  });

  // ---------------------------------------------------------------------
  // Alinhamento: projeta o retângulo da .hero-logo (DOM) para o mundo em z=0,
  // para a marca 3D nascer exatamente no slot do logo, em qualquer breakpoint.
  // ---------------------------------------------------------------------
  var alvo = { x: 0, y: 0, escala: 1 };

  function alturaVisivel(z) {
    // Altura visível (em unidades de mundo) no plano a distância |cam.z - z|.
    var d = Math.abs(camera.position.z - z);
    return 2 * d * Math.tan((FOV * Math.PI / 180) / 2);
  }

  function posicionarMarca() {
    var rHero = canvas.getBoundingClientRect();
    var rSlot = slot.getBoundingClientRect();
    if (!rHero.width || !rHero.height) return;

    var vh = alturaVisivel(0);
    var vw = vh * (rHero.width / rHero.height);

    // centro do slot relativo ao canvas, em px
    var cxPx = (rSlot.left + rSlot.width / 2) - rHero.left;
    var cyPx = (rSlot.top + rSlot.height / 2) - rHero.top;

    alvo.x = (cxPx / rHero.width - 0.5) * vw;
    alvo.y = (0.5 - cyPx / rHero.height) * vh;

    // Escala: a marca fica um pouco maior que o slot chato, para ter presença.
    var mundoPorPx = vh / rHero.height;
    var alturaDesejada = rSlot.height * mundoPorPx * 1.7;
    alvo.escala = alturaDesejada / alturaIntrinseca;

    pivo.position.set(alvo.x, alvo.y, 0);
    pivo.scale.setScalar(alvo.escala);
  }

  // ---------------------------------------------------------------------
  // Redimensionamento
  // ---------------------------------------------------------------------
  function redimensionar() {
    var r = hero.getBoundingClientRect();
    largura = Math.max(1, Math.round(r.width));
    altura = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_MAX));
    renderer.setSize(largura, altura, false);
    camera.aspect = largura / altura;
    camera.updateProjectionMatrix();
    if (marcaPronta) posicionarMarca();
  }
  window.addEventListener('resize', redimensionar);
  redimensionar();

  // ---------------------------------------------------------------------
  // Parallax por ponteiro (desktop). Suavizado; amplitude pequena.
  // ---------------------------------------------------------------------
  var ponteiro = { x: 0, y: 0 };      // -1..1
  var ponteiroAlvo = { x: 0, y: 0 };
  var finoAponta = window.matchMedia && matchMedia('(pointer: fine)').matches;

  if (finoAponta) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      ponteiroAlvo.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ponteiroAlvo.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    });
    hero.addEventListener('pointerleave', function () {
      ponteiroAlvo.x = 0; ponteiroAlvo.y = 0;
    });
  }

  // ---------------------------------------------------------------------
  // Laço de animação — pausa quando o hero sai da tela (economia de bateria).
  // ---------------------------------------------------------------------
  var rodando = false, rafId = null, t0 = performance.now();

  function loop(t) {
    rafId = requestAnimationFrame(loop);
    var dt = (t - t0) / 1000; // segundos desde o início

    // Suaviza o ponteiro
    ponteiro.x += (ponteiroAlvo.x - ponteiro.x) * 0.08;
    ponteiro.y += (ponteiroAlvo.y - ponteiro.y) * 0.08;

    // Marca: leve balanço idle + parallax do ponteiro.
    // O ponteiro pesa bem mais que o balanço ocioso — antes os dois tinham
    // amplitude parecida e o movimento do mouse se perdia dentro do vaivém,
    // dando a impressão de que passar o mouse não fazia nada.
    // Os DOIS eixos seguem o ponteiro: a marca "olha" para onde está o cursor.
    // Atenção ao sinal do eixo vertical. `ponteiro.y` vem da tela, onde Y
    // CRESCE PARA BAIXO (-1 no topo, +1 embaixo), enquanto no mundo 3D o Y
    // cresce para cima. Girar em X com sinal negativo invertia a leitura: o
    // cursor subia e a marca olhava para baixo. Com `+ ponteiro.y`, o cursor
    // no topo dá rotation.x negativo, que inclina a face para cima — que é o
    // mesmo comportamento já correto na horizontal.
    if (marcaPronta) {
      pivo.rotation.y = Math.sin(dt * 0.5) * 0.07 + ponteiro.x * 0.38;
      pivo.rotation.x = Math.cos(dt * 0.4) * 0.035 + ponteiro.y * 0.22;
    }

    renderer.render(scene, camera);
  }

  function iniciar() {
    if (rodando) return;
    rodando = true;
    t0 = performance.now();
    rafId = requestAnimationFrame(loop);
  }
  function parar() {
    rodando = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Só anima com o hero na tela.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entradas) {
      if (entradas[0].isIntersecting) iniciar(); else parar();
    }, { threshold: 0 }).observe(hero);
  } else {
    iniciar();
  }

  // ---------------------------------------------------------------------
  // Limpeza (falha tardia): remove tudo e devolve o hero de hoje.
  // ---------------------------------------------------------------------
  function limpar() {
    parar();
    hero.classList.remove('is-3d');
    try { renderer.dispose(); } catch (e) {}
    canvas.remove();
  }
})();

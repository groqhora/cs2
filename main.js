(function(){
  const $ = (id) => document.getElementById(id);

  const defaultMaps = [
    'Office','Italy','Overpass','Train','Vertigo','Boulder','Fachwerk','Shelter',
    'Dust 2','Inferno','Nuke','Ancient','Anubis','Cache','Mirage'
  ];

  const mapUi = $('map-ui');
  const mapSelect = $('mapSelect');
  const teamSelect = $('teamSelect');
  const uploadMapBtn = $('uploadMapBtn');
  const customMapInput = $('customMapInput');
  const start = $('start');
  const statusEl = $('status');
  const pickBtn = $('pick');

  let activeTeam = 'CT';
  let mapSpawnPoints = { T: null, CT: null };
  let drag = false;
  let px = 0;
  let py = 0;
  let last = performance.now();
  let nades = [];
  let smokes = [];

  function showSelectionUI(){ if(mapUi) mapUi.classList.remove('hidden'); }
  function hideSelectionUI(){ if(mapUi) mapUi.classList.add('hidden'); }
  function showStartMenu(){ if(start) start.classList.remove('hidden'); }
  function hideStartMenu(){ if(start) start.classList.add('hidden'); }

  function setTeamColor(team){
    let color = '#9be7c5';
    if(team === 'T') color = '#ff8f5b';
    if(team === 'CT') color = '#6bb8ff';
    document.documentElement.style.setProperty('--accent', color);
  }

  function fillMapSelect(){
    if(!mapSelect) return;
    mapSelect.innerHTML = '';
    defaultMaps.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      mapSelect.appendChild(opt);
    });
    mapSelect.value = defaultMaps[0];
  }

  function normalizeName(value){ return String(value || '').trim(); }

  function slugify(value){
    return normalizeName(value)
      .toLowerCase()
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function buildMapCandidates(name){
    const clean = normalizeName(name);
    if(!clean) return [];
    if(/\.(glb|gltf)$/i.test(clean)){
      return ['maps/' + clean, clean];
    }
    const slug = slugify(clean);
    return [
      'maps/' + slug + '.glb',
      'maps/' + slug + '.gltf',
      slug + '.glb',
      'maps/map.glb',
      'maps/map.gltf',
      'map.glb'
    ].filter((v, i, arr) => arr.indexOf(v) === i);
  }

  function tryLoadMapUrl(name){
    const candidates = buildMapCandidates(name);
    let idx = 0;

    function next(){
      if(idx >= candidates.length){
        if(statusEl) statusEl.textContent = 'Xarita fayli topilmadi. Oddiy blokli xarita yuklandi. Oʻz .glb faylingizni tanlashingiz mumkin.';
        blockMap();
        resetPlayer();
        return;
      }
      const path = candidates[idx++];
      fetch(path, { method: 'HEAD' }).then((res) => {
        if(res.ok) loadURL(path, name);
        else next();
      }).catch(() => next());
    }
    next();
  }

  function loadMapFromFile(file){
    if(!file) return;
    const url = URL.createObjectURL(file);
    loadURL(url, file.name);
    if(customMapInput) customMapInput.value = '';
  }

  // Tugun nomini topadi (boʻshliq, _ va - hisobga olinmaydi). Dunyo koordinatasini qaytaradi.
  function findNamedSpawn(root, targetNames){
    const norm = (s) => String(s).toLowerCase().replace(/[\s_\-]/g, '');
    const names = targetNames.map(norm);
    root.updateMatrixWorld(true);
    let found = null;
    (function walk(o){
      if(found) return;
      if(o.name && names.indexOf(norm(o.name)) !== -1){ found = o; return; }
      o.children.forEach(walk);
    })(root);
    if(!found) return null;
    const v = new THREE.Vector3();
    found.getWorldPosition(v);
    return v;
  }

  function setSpawnFromMap(root){
    const tSpawn = findNamedSpawn(root, ['T Spawn', 'TSpawn', 'spawn_t', 't_spawn']);
    const ctSpawn = findNamedSpawn(root, ['CT Spawn', 'CTSpawn', 'spawn_ct', 'ct_spawn']);

    mapSpawnPoints.T = tSpawn || null;
    mapSpawnPoints.CT = ctSpawn || null;

    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());

    if(!mapSpawnPoints.T && !mapSpawnPoints.CT){
      mapSpawnPoints.T = new THREE.Vector3(center.x - 5, box.max.y + 1, center.z);
      mapSpawnPoints.CT = new THREE.Vector3(center.x + 5, box.max.y + 1, center.z);
    }

    // Nuqtalarni yerga tushiramiz
    ['T', 'CT'].forEach((k) => {
      const v = mapSpawnPoints[k];
      if(!v) return;
      ray.set(new THREE.Vector3(v.x, box.max.y + 5, v.z), new THREE.Vector3(0, -1, 0));
      ray.far = (box.max.y - box.min.y) + 10;
      const h = ray.intersectObjects(colliders, true);
      if(h.length) v.y = h[0].point.y;
    });
  }

  function getTeamSpawn(){
    const point = mapSpawnPoints[activeTeam] || mapSpawnPoints.CT || mapSpawnPoints.T;
    if(point) return point.clone();
    return new THREE.Vector3(0, 0, 34);
  }

  function resetPlayer(){
    const sp = getTeamSpawn();
    P.x = sp.x;
    P.y = sp.y + 0.05;
    P.z = sp.z;
    P.vy = 0;
    P.yaw = 0;
    P.pitch = 0;
  }

  // --- UI hodisalari ---
  if(mapSelect) mapSelect.addEventListener('change', () => tryLoadMapUrl(mapSelect.value));

  if(teamSelect){
    teamSelect.addEventListener('change', () => {
      activeTeam = teamSelect.value || 'CT';
      setTeamColor(activeTeam);
      resetPlayer();
    });
  }

  if(uploadMapBtn && customMapInput){
    uploadMapBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      customMapInput.click();
    });
  }

  if(pickBtn && customMapInput){
    pickBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      customMapInput.click();
    });
  }

  if(customMapInput){
    customMapInput.addEventListener('change', () => {
      const file = customMapInput.files && customMapInput.files[0];
      if(file) loadMapFromFile(file);
    });
  }

  // --- Three.js sahna ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c4d6);
  scene.fog = new THREE.Fog(0xa9c4d6, 40, 250);

  const cam = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
  cam.rotation.order = 'YXZ';

  const ren = new THREE.WebGLRenderer({ antialias: true });
  ren.setSize(innerWidth, innerHeight);
  ren.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.prepend(ren.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x887766, 1.0));
  const sun = new THREE.DirectionalLight(0xfff2d6, 0.8);
  sun.position.set(50, 100, 30);
  scene.add(sun);

  const world = new THREE.Group();
  scene.add(world);

  let colliders = [];
  let zones = null;

  const P = { x: 0, y: 0, z: 0, vy: 0, yaw: 0, pitch: 0, ground: true, fly: false };
  const R = 0.5;
  const EYE = 1.7;
  const keys = {};
  const ray = new THREE.Raycaster();

  function clearWorld(){
    while(world.children.length > 0) world.remove(world.children[0]);
    colliders = [];
    zones = null;
    mapSpawnPoints = { T: null, CT: null };
  }

  function blockMap(){
    clearWorld();
    const W = 6, wc = 0xd9c9a3, cc = 0x8a6a3c;

    const B = [
      [-40,-40,80,1,W,wc],[-40,39,80,1,W,wc],[-40,-40,1,80,W,wc],[39,-40,1,80,W,wc],
      [-9,-17,1,35,W,wc],[8,-17,1,35,W,wc],[-39,-18,22,1,W,wc],[17,-18,22,1,W,wc],
      [-9,-39,1,9,W,wc],[-9,-24,1,6,W,wc],[8,-39,1,9,W,wc],[8,-24,1,6,W,wc],
      [-26,-31,4,4,3,cc],[-16,-27,3,3,2,cc],[-31,-23,2,2,1.5,cc],
      [22,-31,4,4,3,cc],[16,-27,3,3,2,cc],[31,-23,2,2,1.5,cc],
      [-3,-5,3,3,1.6,cc],[2,6,3,3,1.6,cc],[-25,0,4,3,2,cc],[22,4,4,3,2,cc],[-3,24,6,1,3,cc]
    ];

    const fl = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshLambertMaterial({ color: 0xcdb88a })
    );
    fl.rotation.x = -Math.PI / 2;
    world.add(fl);
    colliders.push(fl);

    B.forEach((b) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(b[2], b[4], b[3]),
        new THREE.MeshLambertMaterial({ color: b[5] })
      );
      m.position.set(b[0] + b[2] / 2, b[4] / 2, b[1] + b[3] / 2);
      world.add(m);
      colliders.push(m);

      const e = new THREE.LineSegments(
        new THREE.EdgesGeometry(m.geometry),
        new THREE.LineBasicMaterial({ color: 0x5a4a2c })
      );
      e.position.copy(m.position);
      world.add(e);
    });

    zones = [
      ['A Site',-39,-39,30,21],
      ['B Site',9,-39,30,21],
      ['CT Spawn',-9,-39,18,21],
      ['T Spawn',-39,18,78,22],
      ['Mid',-9,-18,18,36],
      ['A Long',-39,-18,30,36],
      ['B Long',9,-18,30,36]
    ];

    mapSpawnPoints.T = new THREE.Vector3(-30, 0, 30);
    mapSpawnPoints.CT = new THREE.Vector3(30, 0, 30);
  }

  function zoneAt(x, z){
    if(!zones) return '';
    for(let i = 0; i < zones.length; i++){
      const q = zones[i];
      if(x >= q[1] && x <= q[1] + q[3] && z >= q[2] && z <= q[2] + q[4]) return q[0];
    }
    return '';
  }

  function useGLB(gltf){
    clearWorld();
    const root = gltf.scene;
    world.add(root);

    // Juda katta yoki juda kichik modelni moslash
    let box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const big = Math.max(size.x, size.z);
    if(big > 400 || big < 20){
      root.scale.setScalar(100 / big);
    }
    root.updateMatrixWorld(true);

    root.traverse((o) => {
      if(o.isMesh){
        colliders.push(o);
        if(o.material) o.material.side = THREE.DoubleSide;
      }
    });

    setSpawnFromMap(root);
    resetPlayer();
  }

  function loadURL(url, label){
    if(statusEl) statusEl.textContent = 'Xarita yuklanmoqda…';
    new THREE.GLTFLoader().load(
      url,
      function(gltf){
        useGLB(gltf);
        if(statusEl) statusEl.textContent = label + ' yuklandi. Boshlash uchun bosing.';
      },
      undefined,
      function(error){
        console.error(error);
        blockMap();
        resetPlayer();
        if(statusEl) statusEl.textContent = 'Xaritani oʻqib boʻlmadi. Oddiy xarita yuklandi. Oʻz xaritangizni tanlashingiz mumkin.';
      }
    );
  }

  function wallHit(x, z, dx, dz){
    const d = new THREE.Vector3(dx, 0, dz).normalize();
    const heights = [0.5, 1.0, 1.6];
    for(let i = 0; i < heights.length; i++){
      ray.set(new THREE.Vector3(x, P.y + heights[i], z), d);
      ray.far = R + Math.hypot(dx, dz);
      if(ray.intersectObjects(colliders, true).length > 0) return true;
    }
    return false;
  }

  function groundY(x, y, z){
    ray.set(new THREE.Vector3(x, y + 1.0, z), new THREE.Vector3(0, -1, 0));
    ray.far = 50;
    const h = ray.intersectObjects(colliders, true);
    return h.length ? h[0].point.y : -Infinity;
  }

  function look(dx, dy){
    P.yaw -= dx * 0.0022;
    P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - dy * 0.0022));
  }

  function throwSmoke(){
    const d = new THREE.Vector3();
    cam.getWorldDirection(d);
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x444444 })
    );
    m.position.copy(cam.position).addScaledVector(d, 0.5);
    scene.add(m);
    nades.push({ m, v: d.multiplyScalar(22) });
  }

  function boom(p){
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 16, 16),
      new THREE.MeshLambertMaterial({ color: 0xd0d0d0, transparent: true, opacity: 0.85 })
    );
    s.position.set(p.x, p.y + 1.0, p.z);
    scene.add(s);
    smokes.push({ m: s, t: 0 });
    if(smokes.length > 12){
      const old = smokes.shift();
      scene.remove(old.m);
    }
  }

  function clearSmokes(){
    smokes.forEach((s) => scene.remove(s.m));
    smokes = [];
  }

  // --- Boshqaruv va Pointer Lock ---
  document.addEventListener('pointerlockchange', () => {
    const lockedNow = document.pointerLockElement === ren.domElement;
    if(!lockedNow){
      drag = false;
      showSelectionUI();
      showStartMenu();
    } else {
      hideStartMenu();
      hideSelectionUI();
    }
  });

  // Pointer lock ishlamasa: sichqonchani bosib sudrab qarash rejimi
  document.addEventListener('pointerlockerror', () => {
    hideStartMenu();
    hideSelectionUI();
  });

  if(start){
    start.addEventListener('click', () => {
      try { ren.domElement.requestPointerLock(); }
      catch(e){ hideStartMenu(); hideSelectionUI(); }
    });
  }

  document.addEventListener('keydown', (e) => {
    if(e.code === 'Escape'){
      if(document.pointerLockElement) document.exitPointerLock();
      showSelectionUI();
      showStartMenu();
    }
    keys[e.code] = true;
    if(e.code === 'Space') e.preventDefault();
    if(e.code === 'KeyR') clearSmokes();
    if(e.code === 'KeyE') throwSmoke();
    if(e.code === 'KeyF'){
      P.fly = !P.fly;
      P.vy = 0;
    }
  });

  document.addEventListener('keyup', (e) => { keys[e.code] = false; });

  document.addEventListener('mousemove', (e) => {
    if(document.pointerLockElement === ren.domElement){
      look(e.movementX, e.movementY);
    } else if(drag){
      look(e.clientX - px, e.clientY - py);
      px = e.clientX;
      py = e.clientY;
    }
  });

  ren.domElement.addEventListener('mousedown', (e) => {
    if(document.pointerLockElement !== ren.domElement){
      drag = true;
      px = e.clientX;
      py = e.clientY;
    } else if(e.button === 0){
      throwSmoke();
    }
  });

  document.addEventListener('mouseup', () => { drag = false; });

  // --- Asosiy sikl ---
  function frame(now){
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.04);
    last = now;

    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);

    const sp = P.fly ? 15 : ((keys.ShiftLeft || keys.ShiftRight) ? 2.5 : 5.5);
    const l = Math.hypot(f, s) || 1;
    const sy = Math.sin(P.yaw);
    const cy = Math.cos(P.yaw);

    const dx = (-sy * f + cy * s) / l * sp * dt;
    const dz = (-cy * f - sy * s) / l * sp * dt;

    if(P.fly){
      P.x += dx;
      P.z += dz;
      P.y += ((keys.Space ? 1 : 0) - ((keys.ControlLeft || keys.ControlRight) ? 1 : 0)) * 12 * dt;
    } else if(colliders.length > 0){
      if(dx && !wallHit(P.x, P.z, dx, 0)) P.x += dx;
      if(dz && !wallHit(P.x, P.z, 0, dz)) P.z += dz;

      if(keys.Space && P.ground){
        P.vy = 6.5;
        P.ground = false;
      }

      P.vy -= 20 * dt;
      P.y += P.vy * dt;

      const g = groundY(P.x, P.y, P.z);
      if(P.y <= g){
        P.y = g;
        P.vy = 0;
        P.ground = true;
      } else if(P.ground && (P.y - g < 0.3)){
        P.y = g;
      } else {
        P.ground = false;
      }

      if(P.y < -150) resetPlayer();
    }

    cam.position.set(P.x, P.y + EYE, P.z);
    cam.rotation.set(P.pitch, P.yaw, 0);

    for(let n = nades.length - 1; n >= 0; n--){
      const o = nades[n];
      o.v.y -= 18 * dt;
      const from = o.m.position.clone();
      const step = o.v.clone().multiplyScalar(dt);

      ray.set(from, step.clone().normalize());
      ray.far = step.length() + 0.1;

      const h = colliders.length ? ray.intersectObjects(colliders, true) : [];
      if(h.length > 0){
        boom(h[0].point.clone());
        scene.remove(o.m);
        nades.splice(n, 1);
      } else {
        o.m.position.add(step);
      }
    }

    for(let k = smokes.length - 1; k >= 0; k--){
      smokes[k].t += dt;
      if(smokes[k].t > 15){
        scene.remove(smokes[k].m);
        smokes.splice(k, 1);
      }
    }

    const zoneLabel = $('zone');
    if(zoneLabel) zoneLabel.textContent = zoneAt(P.x, P.z);

    ren.render(scene, cam);
  }

  window.addEventListener('resize', () => {
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
    ren.setSize(innerWidth, innerHeight);
  });

  fillMapSelect();
  setTeamColor(activeTeam);
  showSelectionUI();
  showStartMenu();
  tryLoadMapUrl(defaultMaps[0]);
  requestAnimationFrame(frame);
})();

(function(){
  const $ = (id) => document.getElementById(id);

  const defaultMaps = [
    'Office','Italy','Overpass','Train','Vertigo','Boulder','Fachwerk','Shelter',
    'Dust II (Dust 2)','Inferno','Nuke','Ancient','Anubis','Cache','Mirage'
  ];

  const mapUi = $('map-ui');
  const mapSelect = $('mapSelect');
  const teamSelect = $('teamSelect');
  const uploadMapBtn = $('uploadMapBtn');
  const customMapInput = $('customMapInput');
  const start = $('start');
  const statusEl = $('status');

  let activeTeam = 'CT';
  let mapSpawnPoints = { T: null, CT: null };
  let drag = false;

  function showSelectionUI(){
    if(mapUi) mapUi.classList.remove('hidden');
  }

  function hideSelectionUI(){
    if(mapUi) mapUi.classList.add('hidden');
  }

  function showStartMenu(){
    if(start) start.classList.remove('hidden');
  }

  function hideStartMenu(){
    if(start) start.classList.add('hidden');
  }

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

  function normalizeName(value){
    return String(value || '').trim();
  }

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
      return ['maps/' + clean];
    }

    const slug = slugify(clean);
    const candidates = [
      'maps/' + slug + '.glb',
      'maps/' + slug + '.gltf',
      'maps/map.glb',
      'maps/map.gltf'
    ];

    return candidates.filter((v, i, arr) => arr.indexOf(v) === i);
  }

  function tryLoadMapUrl(name){
    const candidates = buildMapCandidates(name);
    let idx = 0;

    function next(){
      if(idx >= candidates.length){
        if(statusEl) statusEl.textContent = 'Map papkasida bu xarita topilmadi. Upload qiling.';
        return;
      }

      const path = candidates[idx++];
      fetch(path, { method: 'HEAD' }).then((res) => {
        if(res.ok){
          loadURL(path, name);
        } else {
          next();
        }
      }).catch(() => {
        next();
      });
    }

    next();
  }

  function loadMapFromFile(file){
    if(!file) return;
    const url = URL.createObjectURL(file);
    loadURL(url, file.name);
    if(customMapInput) customMapInput.value = '';
  }

  function findNamedSpawn(root, targetNames){
    const names = targetNames.map((n) => String(n).toLowerCase());
    let found = null;

    function walk(obj){
      if(!obj || !obj.name) return false;

      const nodeName = obj.name.toLowerCase();

      for(let i = 0; i < names.length; i++){
        const name = names[i];
        if(
          nodeName === name ||
          nodeName === name.replace(/_/g, ' ') ||
          nodeName === name.replace(/_/g, '-') ||
          nodeName.indexOf(name) !== -1
        ){
          found = obj;
          return true;
        }
      }

      if(obj.children){
        for(let i = 0; i < obj.children.length; i++){
          if(walk(obj.children[i])) return true;
        }
      }

      return false;
    }

    walk(root);

    if(found && found.position){
      return found.position.clone();
    }

    return null;
  }

  function setSpawnFromMap(root){
    const tSpawn = findNamedSpawn(root, ['T Spawn', 'TSpawn', 'spawn_t', 't_spawn', 'tspawn']);
    const ctSpawn = findNamedSpawn(root, ['CT Spawn', 'CTSpawn', 'spawn_ct', 'ct_spawn', 'ctspawn']);

    mapSpawnPoints.T = tSpawn || null;
    mapSpawnPoints.CT = ctSpawn || null;

    if(!mapSpawnPoints.T && !mapSpawnPoints.CT){
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      mapSpawnPoints.T = new THREE.Vector3(center.x, 0, center.z + 10);
      mapSpawnPoints.CT = new THREE.Vector3(center.x, 0, center.z - 10);
    }
  }

  function getTeamSpawn(){
    const point = mapSpawnPoints[activeTeam];
    if(point) return point.clone();
    return new THREE.Vector3(0,0,0);
  }

  function resetPlayer(){
    const spawnPoint = getTeamSpawn();
    P.x = spawnPoint.x;
    P.y = spawnPoint.y;
    P.z = spawnPoint.z;
    P.vy = 0;
    P.yaw = 0;
    P.pitch = 0;
  }

  function setDefaultUIState(){
    showSelectionUI();
    showStartMenu();
  }

  document.addEventListener('keydown', (e) => {
    if(e.code === 'Escape'){
      if(document.pointerLockElement === ren.domElement){
        document.exitPointerLock();
      }
      showSelectionUI();
      showStartMenu();
    }
  });

  if(mapSelect){
    fillMapSelect();
    mapSelect.addEventListener('change', () => {
      tryLoadMapUrl(mapSelect.value);
    });
  }

  if(teamSelect){
    teamSelect.addEventListener('change', () => {
      activeTeam = teamSelect.value || 'CT';
      setTeamColor(activeTeam);
      if(typeof resetPlayer === 'function') resetPlayer();
    });
    teamSelect.value = 'CT';
    setTeamColor(activeTeam);
  }

  if(uploadMapBtn){
    uploadMapBtn.addEventListener('click', () => {
      if(customMapInput) customMapInput.click();
    });
  }

  if(customMapInput){
    customMapInput.addEventListener('change', () => {
      const file = customMapInput.files && customMapInput.files[0];
      if(file) loadMapFromFile(file);
    });
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c4d6);
  scene.fog = new THREE.Fog(0xa9c4d6, 40, 200);

  const cam = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 500);
  cam.rotation.order = 'YXZ';

  const ren = new THREE.WebGLRenderer({ antialias: true });
  ren.setSize(innerWidth, innerHeight);
  ren.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.prepend(ren.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x887766, 0.9));
  const sun = new THREE.DirectionalLight(0xfff2d6, 0.6);
  sun.position.set(20, 40, 10);
  scene.add(sun);

  const world = new THREE.Group();
  scene.add(world);

  let colliders = [];
  let zones = null;
  let spawn = new THREE.Vector3(0, 0, 34);

  function blockMap(){
    const W = 6;
    const wc = 0xd9c9a3;
    const cc = 0x8a6a3c;

    const B = [
      [-40,-40,80,1,W,wc],[-40,39,80,1,W,wc],[-40,-40,1,80,W,wc],[39,-40,1,80,W,wc],
      [-9,-17,1,35,W,wc],[8,-17,1,35,W,wc],[-39,-18,22,1,W,wc],[17,-18,22,1,W,wc],
      [-9,-39,1,9,W,wc],[-9,-24,1,6,W,wc],[8,-39,1,9,W,wc],[8,-24,1,6,W,wc],
      [-26,-31,4,4,3,cc],[-16,-27,3,3,2,cc],[-31,-23,2,2,1.5,cc],
      [22,-31,4,4,3,cc],[16,-27,3,3,2,cc],[31,-23,2,2,1.5,cc],
      [-3,-5,3,3,1.6,cc],[2,6,3,3,1.6,cc],[-25,0,4,3,2,cc],[22,4,4,3,2,cc],[-3,24,6,1,3,cc]
    ];

    const fl = new THREE.Mesh(
      new THREE.PlaneGeometry(80,80),
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

    spawn.set(0,0,34);
    mapSpawnPoints.T = new THREE.Vector3(-30, 0, 30);
    mapSpawnPoints.CT = new THREE.Vector3(30, 0, 30);
  }

  function clearWorld(){
    while(world.children.length) world.remove(world.children[0]);
    colliders = [];
    zones = null;
    mapSpawnPoints = { T: null, CT: null };
  }

  function zoneAt(x, z){
    if(!zones) return '';
    for(let i = 0; i < zones.length; i++){
      const q = zones[i];
      if(x >= q[1] && x <= q[1] + q[3] && z >= q[2] && z <= q[2] + q[4]){
        return q[0];
      }
    }
    return '';
  }

  function useGLB(gltf){
    clearWorld();
    const root = gltf.scene;
    world.add(root);

    setSpawnFromMap(root);

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const big = Math.max(size.x, size.z);

    if(big > 400 || big < 20){
      const s = 100 / big;
      root.scale.setScalar(s);
      root.updateMatrixWorld(true);
      box.setFromObject(root);
    }

    root.traverse((o) => {
      if(o.isMesh){
        colliders.push(o);
        if(o.material) o.material.side = THREE.DoubleSide;
      }
    });

    const c = box.getCenter(new THREE.Vector3());
    const rc = new THREE.Raycaster(
      new THREE.Vector3(c.x, box.max.y + 5, c.z),
      new THREE.Vector3(0, -1, 0)
    );

    const h = rc.intersectObjects(colliders, false);
    spawn.set(c.x, h.length ? h[0].point.y : box.min.y, c.z);

    resetPlayer();
  }

  function loadURL(url, label){
    if(statusEl) statusEl.textContent = 'Xarita yuklanmoqda…';

    new THREE.GLTFLoader().load(
      url,
      function(gltf){
        useGLB(gltf);
        if(statusEl) statusEl.textContent = label + ' yuklandi.';
        hideStartMenu();
      },
      undefined,
      function(){
        if(!colliders.length){
          blockMap();
          resetPlayer();
        }
        if(statusEl) statusEl.textContent = 'Map topilmadi. Upload qiling.';
      }
    );
  }

  const P = {
    x: 0, y: 0, z: 0,
    vy: 0,
    yaw: 0,
    pitch: 0,
    ground: true,
    fly: false
  };

  const R = 0.4;
  const EYE = 1.7;
  const keys = {};

  const ray = new THREE.Raycaster();

  function wallHit(x, z, dx, dz){
    const d = new THREE.Vector3(dx, 0, dz).normalize();
    for(let hh = 0.5; hh <= 1.4; hh += 0.45){
      ray.set(new THREE.Vector3(x, P.y + hh, z), d);
      ray.far = R + Math.hypot(dx, dz);
      if(ray.intersectObjects(colliders, false).length) return true;
    }
    return false;
  }

  function groundY(x, y, z){
    ray.set(new THREE.Vector3(x, y + 0.6, z), new THREE.Vector3(0, -1, 0));
    ray.far = 100;
    const h = ray.intersectObjects(colliders, false);
    return h.length ? h[0].point.y : -Infinity;
  }

  function look(dx, dy){
    P.yaw -= dx * 0.0025;
    P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch - dy * 0.0025));
  }

  function throwSmoke(){
    const d = new THREE.Vector3();
    cam.getWorldDirection(d);

    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x333333 })
    );
    m.position.copy(cam.position).addScaledVector(d, 0.6);
    scene.add(m);

    nades.push({ m, v: d.multiplyScalar(18) });
  }

  function boom(p){
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(3.4, 20, 14),
      new THREE.MeshLambertMaterial({
        color: 0xe6e6e6,
        transparent: true,
        opacity: 0.93
      })
    );
    s.position.set(p.x, p.y + 1.2, p.z);
    scene.add(s);

    smokes.push({ m: s, t: 0 });
    if(smokes.length > 8){
      scene.remove(smokes.shift().m);
    }
  }

  function clearSmokes(){
    smokes.forEach((s) => scene.remove(s.m));
    smokes = [];
  }

  let nades = [];
  let smokes = [];

  document.addEventListener('pointerlockchange', () => {
    const lockedNow = document.pointerLockElement === ren.domElement;
    if(!lockedNow && !drag){
      showSelectionUI();
      showStartMenu();
    }
  });

  start.addEventListener('click', () => {
    hideStartMenu();
    hideSelectionUI();
    try{
      ren.domElement.requestPointerLock();
    } catch (e) {}
  });

  document.addEventListener('keydown', (e) => {
    if(e.code === 'Escape'){
      if(document.pointerLockElement === ren.domElement){
        document.exitPointerLock();
      }
      showSelectionUI();
      showStartMenu();
    }

    keys[e.code] = true;

    if(e.code === 'Space') e.preventDefault();
    if(e.code === 'KeyR') clearSmokes();
    if(e.code === 'KeyF'){
      P.fly = !P.fly;
      P.vy = 0;
    }
  });

  document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  document.addEventListener('mousemove', (e) => {
    if(document.pointerLockElement === ren.domElement){
      look(e.movementX, e.movementY);
    } else if(drag){
      look(e.clientX - px, e.clientY - py);
      px = e.clientX;
      py = e.clientY;
    }
  });

  let px = 0;
  let py = 0;

  ren.domElement.addEventListener('mousedown', (e) => {
    if(document.pointerLockElement !== ren.domElement){
      drag = true;
      px = e.clientX;
      py = e.clientY;
      hideStartMenu();
    } else if(e.button === 0){
      throwSmoke();
    }
  });

  document.addEventListener('mouseup', () => {
    drag = false;
  });

  function frame(now){
    requestAnimationFrame(frame);

    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);

    const sp = P.fly ? 12 : ((keys.ShiftLeft || keys.ShiftRight) ? 2.6 : 5.2);
    const l = Math.hypot(f, s) || 1;
    const sy = Math.sin(P.yaw);
    const cy = Math.cos(P.yaw);

    const dx = (-sy * f + cy * s) / l * sp * dt;
    const dz = (-cy * f - sy * s) / l * sp * dt;

    if(P.fly){
      P.x += dx;
      P.z += dz;
      P.y += ((keys.Space ? 1 : 0) - ((keys.ControlLeft || keys.ControlRight) ? 1 : 0)) * 10 * dt;
    } else if(colliders.length){
      if(dx && !wallHit(P.x, P.z, dx, 0)) P.x += dx;
      if(dz && !wallHit(P.x, P.z, 0, dz)) P.z += dz;

      if(keys.Space && P.ground){
        P.vy = 6.2;
        P.ground = false;
      }

      P.vy -= 18 * dt;
      P.y += P.vy * dt;

      const g = groundY(P.x, P.y, P.z);

      if(P.y <= g){
        P.y = g;
        P.vy = 0;
        P.ground = true;
      } else if(P.ground && P.y - g < 0.4){
        P.y = g;
      } else {
        P.ground = false;
      }

      if(P.y < -200) resetPlayer();
    }

    cam.position.set(P.x, P.y + EYE, P.z);
    cam.rotation.set(P.pitch, P.yaw, 0);

    for(let n = nades.length - 1; n >= 0; n--){
      const o = nades[n];
      o.v.y -= 20 * dt;
      const from = o.m.position.clone();
      const step = o.v.clone().multiplyScalar(dt);
      const len = step.length();

      ray.set(from, step.clone().normalize());
      ray.far = len + 0.1;

      const h = colliders.length ? ray.intersectObjects(colliders, false) : [];
      if(h.length){
        boom(h[0].point.clone().addScaledVector(step.normalize(), -0.3));
        scene.remove(o.m);
        nades.splice(n, 1);
      } else {
        o.m.position.add(step);
      }
    }

    for(let k = smokes.length - 1; k >= 0; k--){
      smokes[k].t += dt;
      if(smokes[k].t > 18){
        scene.remove(smokes[k].m);
        smokes.splice(k, 1);
      }
    }

    const zn = zoneAt(P.x, P.z);
    if($('zone')) $('zone').textContent = zn;

    ren.render(scene, cam);
  }

  let last = performance.now();

  addEventListener('resize', () => {
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
    ren.setSize(innerWidth, innerHeight);
  });

  setDefaultUIState();
  fillMapSelect();
  setTeamColor(activeTeam);

  tryLoadMapUrl(defaultMaps[0]);

  requestAnimationFrame(frame);
})();

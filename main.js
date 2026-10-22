(function(){
  var $=function(i){return document.getElementById(i)};

  var defaultMaps=[
    'Office','Italy','Overpass','Train','Vertigo','Boulder','Fachwerk','Shelter',
    'Dust II (Dust 2)','Inferno','Nuke','Ancient','Anubis','Cache','Mirage'
  ];

  var mapSelect=$('mapSelect');
  var teamSelect=$('teamSelect');
  var uploadMapBtn=$('uploadMapBtn');
  var customMapInput=$('customMapInput');
  var start=$('start');

  var activeTeam = 'CT';
  var mapSpawnPoints = { T: null, CT: null };

  function setTeamColor(team){
    var color = '#9be7c5';
    if(team === 'T') color = '#ff8f5b';
    if(team === 'CT') color = '#6bb8ff';
    document.documentElement.style.setProperty('--accent', color);
  }

  function fillMapSelect(){
    if(!mapSelect) return;
    mapSelect.innerHTML='';
    defaultMaps.forEach(function(name){
      var opt=document.createElement('option');
      opt.value=name; opt.textContent=name;
      mapSelect.appendChild(opt);
    });
    mapSelect.value=defaultMaps[0];
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
    var clean = normalizeName(name);
    if(!clean) return [];

    var direct = [];
    if(/\.(glb|gltf)$/i.test(clean)){
      direct.push('maps/' + clean);
      return direct;
    }

    var slug = slugify(clean);
    var names = [
      'maps/' + slug + '.glb',
      'maps/' + slug + '.gltf',
      'maps/map.glb',
      'maps/map.gltf'
    ];

    return names.filter(function(item, idx, arr){ return arr.indexOf(item) === idx; });
  }

  function tryLoadMapUrl(name){
    var candidates = buildMapCandidates(name);
    var idx = 0;

    function next(){
      if(idx >= candidates.length){
        $('status').textContent = 'Map papkasida bu xarita topilmadi. Upload qiling.';
        return;
      }
      var path = candidates[idx++];
      fetch(path,{method:'HEAD'}).then(function(res){
        if(res.ok){
          loadURL(path, name);
        } else {
          next();
        }
      }).catch(function(){ next(); });
    }

    next();
  }

  function loadMapFromFile(file){
    if(!file) return;
    var url=URL.createObjectURL(file);
    loadURL(url, file.name);
    customMapInput.value='';
  }

  function showStartMenu(){ if(start) start.style.display='flex'; }
  function hideStartMenu(){ if(start) start.style.display='none'; }

  function findNamedSpawn(root, targetNames){
    var names = targetNames.map(function(name){ return String(name).toLowerCase(); });
    var found = null;

    function walk(obj){
      if(!obj || !obj.name) return false;
      var n = obj.name.toLowerCase();
      for(var i=0;i<names.length;i++){
        var name = names[i];
        if(n === name || n === name.replace(/_/g,' ') || n === name.replace(/_/g,'-') || n.indexOf(name) !== -1){
          found = obj;
          return true;
        }
      }
      if(obj.children){
        for(var i=0;i<obj.children.length;i++){
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
    var tSpawn = findNamedSpawn(root, ['T Spawn','TSpawn','spawn_t','t_spawn','tspawn']);
    var ctSpawn = findNamedSpawn(root, ['CT Spawn','CTSpawn','spawn_ct','ct_spawn','ctspawn']);

    mapSpawnPoints.T = tSpawn || null;
    mapSpawnPoints.CT = ctSpawn || null;

    if(!mapSpawnPoints.T && !mapSpawnPoints.CT){
      var box = new THREE.Box3().setFromObject(root);
      var center = box.getCenter(new THREE.Vector3());
      mapSpawnPoints.T = new THREE.Vector3(center.x, 0, center.z + 10);
      mapSpawnPoints.CT = new THREE.Vector3(center.x, 0, center.z - 10);
    }
  }

  function getTeamSpawn(){
    var point = mapSpawnPoints[activeTeam];
    if(point) return point.clone();
    return new THREE.Vector3(0,0,0);
  }

  if(mapSelect){
    fillMapSelect();
    mapSelect.addEventListener('change', function(){ tryLoadMapUrl(this.value); });
  }

  if(teamSelect){
    teamSelect.addEventListener('change', function(){
      activeTeam = this.value || 'CT';
      setTeamColor(activeTeam);
      if(typeof resetPlayer === 'function') resetPlayer();
    });
    teamSelect.value = 'CT';
    setTeamColor(activeTeam);
  }

  if(uploadMapBtn){
    uploadMapBtn.addEventListener('click', function(){ customMapInput && customMapInput.click(); });
  }

  if(customMapInput){
    customMapInput.addEventListener('change', function(){
      var file = this.files && this.files[0];
      if(file) loadMapFromFile(file);
    });
  }

  var scene=new THREE.Scene();scene.background=new THREE.Color(0xa9c4d6);scene.fog=new THREE.Fog(0xa9c4d6,40,200);
  var cam=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.1,500);cam.rotation.order='YXZ';
  var ren=new THREE.WebGLRenderer({antialias:true});ren.setSize(innerWidth,innerHeight);ren.setPixelRatio(Math.min(devicePixelRatio,2));
  document.body.prepend(ren.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff,0x887766,0.9));
  var sun=new THREE.DirectionalLight(0xfff2d6,0.6);sun.position.set(20,40,10);scene.add(sun);

  var world=new THREE.Group();scene.add(world);
  var colliders=[],zones=null,spawn=new THREE.Vector3(0,0,34);

  function blockMap(){
    var W=6,wc=0xd9c9a3,cc=0x8a6a3c;
    var B=[[-40,-40,80,1,W,wc],[-40,39,80,1,W,wc],[-40,-40,1,80,W,wc],[39,-40,1,80,W,wc],
     [-9,-17,1,35,W,wc],[8,-17,1,35,W,wc],[-39,-18,22,1,W,wc],[17,-18,22,1,W,wc],
     [-9,-39,1,9,W,wc],[-9,-24,1,6,W,wc],[8,-39,1,9,W,wc],[8,-24,1,6,W,wc],
     [-26,-31,4,4,3,cc],[-16,-27,3,3,2,cc],[-31,-23,2,2,1.5,cc],
     [22,-31,4,4,3,cc],[16,-27,3,3,2,cc],[31,-23,2,2,1.5,cc],
     [-3,-5,3,3,1.6,cc],[2,6,3,3,1.6,cc],[-25,0,4,3,2,cc],[22,4,4,3,2,cc],[-3,24,6,1,3,cc]];
    var fl=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshLambertMaterial({color:0xcdb88a}));
    fl.rotation.x=-Math.PI/2;world.add(fl);colliders.push(fl);
    B.forEach(function(b){var m=new THREE.Mesh(new THREE.BoxGeometry(b[2],b[4],b[3]),new THREE.MeshLambertMaterial({color:b[5]}));
      m.position.set(b[0]+b[2]/2,b[4]/2,b[1]+b[3]/2);world.add(m);colliders.push(m);
      var e=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:0x5a4a2c}));e.position.copy(m.position);world.add(e)});
    zones=[['A Site',-39,-39,30,21],['B Site',9,-39,30,21],['CT Spawn',-9,-39,18,21],['T Spawn',-39,18,78,22],['Mid',-9,-18,18,36],['A Long',-39,-18,30,36],['B Long',9,-18,30,36]];
    spawn.set(0,0,34);
    mapSpawnPoints.T = new THREE.Vector3(-30,0,30);
    mapSpawnPoints.CT = new THREE.Vector3(30,0,30);
  }

  function zoneAt(x,z){if(!zones)return '';for(var i=0;i<zones.length;i++){var q=zones[i];if(x>=q[1]&&x<=q[1]+q[3]&&z>=q[2]&&z<=q[2]+q[4])return q[0]}return ''}

  function clearWorld(){while(world.children.length)world.remove(world.children[0]);colliders=[];zones=null;mapSpawnPoints.T=null;mapSpawnPoints.CT=null}

  function useGLB(gltf){
    clearWorld();
    var root=gltf.scene;
    world.add(root);
    setSpawnFromMap(root);

    var box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
    var big=Math.max(size.x,size.z);
    if(big>400||big<20){var s=100/big;root.scale.setScalar(s);root.updateMatrixWorld(true);box.setFromObject(root)}
    root.traverse(function(o){if(o.isMesh){colliders.push(o);if(o.material)o.material.side=THREE.DoubleSide}});
    var c=box.getCenter(new THREE.Vector3());
    var rc=new THREE.Raycaster(new THREE.Vector3(c.x,box.max.y+5,c.z),new THREE.Vector3(0,-1,0));
    var h=rc.intersectObjects(colliders,false);
    spawn.set(c.x,h.length?h[0].point.y:box.min.y,c.z);
    resetPlayer();
  }

  function loadURL(url,label){
    if($('status')) $('status').textContent='Xarita yuklanmoqda…';
    new THREE.GLTFLoader().load(url,function(g){
      useGLB(g);
      if($('status')) $('status').textContent = label + ' yuklandi.';
      hideStartMenu();
    }, undefined, function(){
      if(!colliders.length){ blockMap(); resetPlayer(); }
      if($('status')) $('status').textContent = 'Map topilmadi. Upload qiling.';
    });
  }

  var P={x:0,y:0,z:0,vy:0,yaw:0,pitch:0,ground:true,fly:false},R=0.4,EYE=1.7,keys={};
  function resetPlayer(){
    var spawnPoint = getTeamSpawn();
    P.x = spawnPoint.x;
    P.y = spawnPoint.y;
    P.z = spawnPoint.z;
    P.vy = 0;
    P.yaw = 0;
    P.pitch = 0;
  }
  var ray=new THREE.Raycaster();

  function wallHit(x,z,dx,dz){
    var d=new THREE.Vector3(dx,0,dz).normalize();
    for(var hh=0.5;hh<=1.4;hh+=0.45){
      ray.set(new THREE.Vector3(x,P.y+hh,z),d);ray.far=R+Math.hypot(dx,dz);
      if(ray.intersectObjects(colliders,false).length)return true
    }
    return false
  }
  function groundY(x,y,z){
    ray.set(new THREE.Vector3(x,y+0.6,z),new THREE.Vector3(0,-1,0));ray.far=100;
    var h=ray.intersectObjects(colliders,false);return h.length?h[0].point.y:-Infinity
  }

  start.addEventListener('click', function(){
    hideStartMenu();
    try{ ren.domElement.requestPointerLock(); }catch(e){}
  });

  document.addEventListener('keydown', function(e){
    if(e.code === 'Escape'){
      if(document.pointerLockElement === ren.domElement){
        document.exitPointerLock();
      }
      showStartMenu();
    }
    keys[e.code]=true;
    if(e.code==='Space') e.preventDefault();
    if(e.code==='KeyR') clearSmokes();
    if(e.code==='KeyF'){ P.fly=!P.fly; P.vy=0; }
  });
  document.addEventListener('keyup', function(e){ keys[e.code]=false; });

  document.addEventListener('pointerlockchange', function(){
    var lockedNow = document.pointerLockElement === ren.domElement;
    if(!lockedNow && !drag) showStartMenu();
  });

  function look(dx,dy){P.yaw-=dx*0.0025;P.pitch=Math.max(-1.5,Math.min(1.5,P.pitch-dy*0.0025))}
  document.addEventListener('mousemove',function(e){
    if(document.pointerLockElement === ren.domElement) look(e.movementX,e.movementY);
    else if(drag){ look(e.clientX-px,e.clientY-py); px=e.clientX; py=e.clientY; }
  });
  ren.domElement.addEventListener('mousedown',function(e){
    if(document.pointerLockElement !== ren.domElement){
      drag=true; px=e.clientX; py=e.clientY; hideStartMenu();
    } else if(e.button===0) throwSmoke();
  });
  document.addEventListener('mouseup',function(){drag=false});

  var nades=[],smokes=[],ng=new THREE.SphereGeometry(0.12,10,8),nm=new THREE.MeshBasicMaterial({color:0x333333});
  function throwSmoke(){var d=new THREE.Vector3();cam.getWorldDirection(d);
    var m=new THREE.Mesh(ng,nm);m.position.copy(cam.position).addScaledVector(d,0.6);scene.add(m);nades.push({m:m,v:d.multiplyScalar(18)})}
  function boom(p){var s=new THREE.Mesh(new THREE.SphereGeometry(3.4,20,14),new THREE.MeshLambertMaterial({color:0xe6e6e6,transparent:true,opacity:0.93}));
    s.position.set(p.x,p.y+1.2,p.z);scene.add(s);smokes.push({m:s,t:0});if(smokes.length>8)scene.remove(smokes.shift().m)}
  function clearSmokes(){smokes.forEach(function(s){scene.remove(s.m)});smokes=[]}

  var last=performance.now();
  function frame(now){requestAnimationFrame(frame);var dt=Math.min((now-last)/1000,0.05);last=now;
    var f=(keys.KeyW?1:0)-(keys.KeyS?1:0),s=(keys.KeyD?1:0)-(keys.KeyA?1:0);
    var sp=P.fly?12:((keys.ShiftLeft||keys.ShiftRight)?2.6:5.2),l=Math.hypot(f,s)||1,sy=Math.sin(P.yaw),cy=Math.cos(P.yaw);
    var dx=(-sy*f+cy*s)/l*sp*dt,dz=(-cy*f-sy*s)/l*sp*dt;
    if(P.fly){P.x+=dx;P.z+=dz;P.y+=((keys.Space?1:0)-((keys.ControlLeft||keys.ControlRight)?1:0))*10*dt}
    else if(colliders.length){
      if(dx&&!wallHit(P.x,P.z,dx,0))P.x+=dx;
      if(dz&&!wallHit(P.x,P.z,0,dz))P.z+=dz;
      if(keys.Space&&P.ground){P.vy=6.2;P.ground=false}
      P.vy-=18*dt;P.y+=P.vy*dt;
      var g=groundY(P.x,P.y,P.z);
      if(P.y<=g){P.y=g;P.vy=0;P.ground=true}else if(P.ground&&P.y-g<0.4){P.y=g}else P.ground=false;
      if(P.y<-200)resetPlayer()}
    cam.position.set(P.x,P.y+EYE,P.z);cam.rotation.set(P.pitch,P.yaw,0);
    for(var n=nades.length-1;n>=0;n--){var o=nades[n];o.v.y-=20*dt;
      var from=o.m.position.clone(),step=o.v.clone().multiplyScalar(dt),len=step.length();
      ray.set(from,step.clone().normalize());ray.far=len+0.1;var h=colliders.length?ray.intersectObjects(colliders,false):[];
      if(h.length){boom(h[0].point.clone().addScaledVector(step.normalize(),-0.3));scene.remove(o.m);nades.splice(n,1)}
      else o.m.position.add(step)}
    for(var k=smokes.length-1;k>=0;k--){smokes[k].t+=dt;if(smokes[k].t>18){scene.remove(smokes[k].m);smokes.splice(k,1)}}
    var zn=zoneAt(P.x,P.z);if($('zone')) $('zone').textContent=zn;
    ren.render(scene,cam)}
  addEventListener('resize',function(){cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();ren.setSize(innerWidth,innerHeight)});

  tryLoadMapUrl(mapSelect ? mapSelect.value : 'map.glb');
  requestAnimationFrame(frame);
})();

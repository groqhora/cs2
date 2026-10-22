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
      opt.value=name;
      opt.textContent=name;
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

    if(/\.(glb|gltf)$/i.test(clean)){
      return ['maps/' + clean];
    }

    var slug = slugify(clean);
    var candidates = [
      'maps/' + slug + '.glb',
      'maps/' + slug + '.gltf',
      'maps/map.glb',
      'maps/map.gltf'
    ];

    return candidates.filter(function(item, idx, arr){ return arr.indexOf(item) === idx; });
  }

  function tryLoadMapUrl(name){
    var candidates = buildMapCandidates(name);
    var idx = 0;

    function next(){
      if(idx >= candidates.length){
        if($('status')) $('status').textContent = 'Map papkasida bu xarita topilmadi. Upload qiling.';
        return;
      }

      var path = candidates[idx++];
      fetch(path, {method:'HEAD'}).then(function(res){
        if(res.ok){
          loadURL(path, name);
        } else {
          next();
        }
      }).catch(function(){
        next();
      });
    }

    next();
  }

  function loadMapFromFile(file){
    if(!file) return;
    var url = URL.createObjectURL(file);
    loadURL(url, file.name);
    if(customMapInput) customMapInput.value = '';
  }

  function showStartMenu(){
    if(start) start.style.display='flex';
  }

  function hideStartMenu(){
    if(start) start.style.display='none';
  }

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
    mapSelect.addEventListener('change', function(){
      tryLoadMapUrl(this.value);
    });
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
    uploadMapBtn.addEventListener('click', function(){
      if(customMapInput) customMapInput.click();
    });
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
    B.forEach(function(b){var m=new THREE.Mesh(new THREE.BoxGeometry(b[2],b[4],b[3]),new THREE.MeshLambertMaterial({color:b[5]}));\n      m.position.set(b[0]+b[2]/2,b[4]/2,b[1]+b[3]/2);world.add(m);colliders.push(m);\n      var e=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:0x5a4a2c}));e.position.copy(m.position);world.add(e)});\n    zones=[['A Site',-39,-39,30,21],['B Site',9,-39,30,21],['CT Spawn',-9,-39,18,21],['T Spawn',-39,18,78,22],['Mid',-9,-18,18,36],['A Long',-39,-18,30,36],['B Long',9,-18,30,36]];\n    spawn.set(0,0,34);\n    mapSpawnPoints.T = new THREE.Vector3(-30,0,30);\n    mapSpawnPoints.CT = new THREE.Vector3(30,0,30);\n  }\n\n  function zoneAt(x,z){if(!zones)return '';for(var i=0;i<zones.length;i++){var q=zones[i];if(x>=q[1]&&x<=q[1]+q[3]&&z>=q[2]&&z<=q[2]+q[4])return q[0]}return ''}\n\n  function clearWorld(){while(world.children.length)world.remove(world.children[0]);colliders=[];zones=null;mapSpawnPoints.T=null;mapSpawnPoints.CT=null}\n\n  function useGLB(gltf){\n    clearWorld();\n    var root=gltf.scene;world.add(root);\n    setSpawnFromMap(root);\n\n    var box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());\n    var big=Math.max(size.x,size.z);\n    if(big>400||big<20){var s=100/big;root.scale.setScalar(s);root.updateMatrixWorld(true);box.setFromObject(root)}\n    root.traverse(function(o){if(o.isMesh){colliders.push(o);if(o.material)o.material.side=THREE.DoubleSide}});\n    var c=box.getCenter(new THREE.Vector3());\n    var rc=new THREE.Raycaster(new THREE.Vector3(c.x,box.max.y+5,c.z),new THREE.Vector3(0,-1,0));\n    var h=rc.intersectObjects(colliders,false);\n    spawn.set(c.x,h.length?h[0].point.y:box.min.y,c.z);\n    resetPlayer();\n  }\n\n  function loadURL(url,label){\n    if($('status')) $('status').textContent='Xarita yuklanmoqda…';\n    new THREE.GLTFLoader().load(url,function(g){\n      useGLB(g);\n      if($('status')) $('status').textContent=label + ' yuklandi.';\n      hideStartMenu();\n    }, undefined, function(){\n      if(!colliders.length){\n        blockMap();\n        resetPlayer();\n      }\n      if($('status')) $('status').textContent='Map topilmadi. Upload qiling.';\n    });\n  }\n\n  var P={x:0,y:0,z:0,vy:0,yaw:0,pitch:0,ground:true,fly:false},R=0.4,EYE=1.7,keys={};\n  function resetPlayer(){\n    var spawnPoint = getTeamSpawn();\n    P.x = spawnPoint.x;\n    P.y = spawnPoint.y;\n    P.z = spawnPoint.z;\n    P.vy = 0;\n    P.yaw = 0;\n    P.pitch = 0;\n


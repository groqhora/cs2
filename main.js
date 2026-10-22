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

  function mapSlug(name){
    return String(name || '').trim().toLowerCase()
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function mapPath(name){
    var clean = String(name || '').trim();
    if(!clean) return '';
    if(/\.(glb|gltf)$/i.test(clean)) return 'maps/' + clean;
    return 'maps/' + mapSlug(clean) + '.glb';
  }

  function fillMapSelect(){
    mapSelect.innerHTML = '';
    defaultMaps.forEach(function(name){
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      mapSelect.appendChild(opt);
    });
    mapSelect.value = defaultMaps[0];
  }

  function setTeamColor(team){
    var color = '#9be7c5';
    if(team === 'T') color = '#ff8f5b';
    if(team === 'CT') color = '#6bb8ff';
    document.documentElement.style.setProperty('--accent', color);
  }

  function loadMapFromFile(file){
    if(!file) return;
    var url = URL.createObjectURL(file);
    var label = file.name;
    loadURL(url, label);
    customMapInput.value = '';
  }

  function tryLoadPresetMap(name){
    var path = mapPath(name);
    fetch(path, {method: 'HEAD'}).then(function(res){
      if(res.ok) loadURL(path, name);
      else $('status').textContent = 'Map papkasida bu xarita topilmadi. Iltimos, upload qiling.';
    }).catch(function(){
      $('status').textContent = 'Map papkasida bu xarita topilmadi. Iltimos, upload qiling.';
    });
  }

  mapSelect.addEventListener('change', function(){
    tryLoadPresetMap(this.value);
  });

  teamSelect.addEventListener('change', function(){
    setTeamColor(this.value);
    $('status').textContent = 'Team: ' + this.value + ' tanlandi';
  });

  uploadMapBtn.addEventListener('click', function(){ customMapInput.click(); });
  customMapInput.addEventListener('change', function(){
    var file = this.files && this.files[0];
    if(file) loadMapFromFile(file);
  });

  fillMapSelect();
  setTeamColor(teamSelect.value);

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
  }
  function zoneAt(x,z){if(!zones)return '';for(var i=0;i<zones.length;i++){var q=zones[i];if(x>=q[1]&&x<=q[1]+q[3]&&z>=q[2]&&z<=q[2]+q[4])return q[0]}return ''}

  function clearWorld(){while(world.children.length)world.remove(world.children[0]);colliders=[];zones=null}
  function useGLB(gltf){
    clearWorld();var root=gltf.scene;world.add(root);
    var box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
    var big=Math.max(size.x,size.z);
    if(big>400||big<20){var s=100/big;root.scale.setScalar(s);root.updateMatrixWorld(true);box.setFromObject(root)}
    root.traverse(function(o){if(o.isMesh){colliders.push(o);if(o.material)o.material.side=THREE.DoubleSide}});
    var c=box.getCenter(new THREE.Vector3());
    var rc=new THREE.Raycaster(new THREE.Vector3(c.x,box.max.y+5,c.z),new THREE.Vector3(0,-1,0));
    var h=rc.intersectObjects(colliders,false);
    spawn.set(c.x,h.length?h[0].point.y:box.min.y,c.z);
  }
  function loadURL(url,label){
    $('status').textContent='Xarita yuklanmoqda…';
    new THREE.GLTFLoader().load(url,function(g){useGLB(g);$('status').textContent=label+' yuklandi.';resetPlayer();},
     undefined,function(){if(!colliders.length){blockMap();resetPlayer()}$('status').textContent='Map topilmadi. Foydalanuvchi tanlagan map yoki upload fayli ishlatildi.'});
  }

  $('pick').addEventListener('click',function(e){e.stopPropagation();$('file').click()});
  $('file').addEventListener('change',function(){var f=this.files[0];if(f)loadMapFromFile(f)});

  var P={x:0,y:0,z:0,vy:0,yaw:0,pitch:0,ground:true,fly:false},R=0.4,EYE=1.7,keys={};
  function resetPlayer(){P.x=spawn.x;P.y=spawn.y;P.z=spawn.z;P.vy=0;P.yaw=0;P.pitch=0}
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

  var locked=false,drag=false,px=0,py=0,start=$('start');
  start.addEventListener('click',function(){start.style.display='none';try{ren.domElement.requestPointerLock()}catch(e){}});
  document.addEventListener('pointerlockchange',function(){locked=document.pointerLockElement===ren.domElement;if(!locked&&!drag)start.style.display='flex'});
  function look(dx,dy){P.yaw-=dx*0.0025;P.pitch=Math.max(-1.5,Math.min(1.5,P.pitch-dy*0.0025))}
  document.addEventListener('mousemove',function(e){if(locked)look(e.movementX,e.movementY);else if(drag){look(e.clientX-px,e.clientY-py);px=e.clientX;py=e.clientY}});
  ren.domElement.addEventListener('mousedown',function(e){if(!locked){drag=true;px=e.clientX;py=e.clientY;start.style.display='none'}else if(e.button===0)throwSmoke()});
  document.addEventListener('mouseup',function(){drag=false});
  document.addEventListener('keydown',function(e){keys[e.code]=true;if(e.code==='Space')e.preventDefault();
    if(e.code==='KeyR')clearSmokes();if(e.code==='KeyF'){P.fly=!P.fly;P.vy=0}});
  document.addEventListener('keyup',function(e){keys[e.code]=false});

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
    var zn=zoneAt(P.x,P.z);$('zone').textContent=zn;
    ren.render(scene,cam)}
  addEventListener('resize',function(){cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();ren.setSize(innerWidth,innerHeight)});

  tryLoadPresetMap(defaultMaps[0]);
  requestAnimationFrame(frame);
})();

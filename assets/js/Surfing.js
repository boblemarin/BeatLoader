(function(w,d,b){
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
// DECLARATIONS
/////////////////////////////////////////////////////////////////
var c = d.getElementById("bs-canvas"),
	menu = d.getElementById("menu"),
	ctx = c.getContext("2d"),
	fluid = true,
	trails = false,
	sw, sh, i, n, dx, dy,t,
	offsetX = 200,
	offsetY = 200,
	stepX = 145,
	stepY = 85,
	origins = [
		0,0, 1,1, 0,2, 1,5, 1,3,
		0,4, 0,6, 1,7, 2,6, 2,4
	],
	points = [],
	numPoints = origins.length,
	segments = [
		0,1, 0,2, 1,2, 1,4, 2,4, 2,5, // "head"
		4,5, 5,6, 6,7, 7,8, 8,9, 9,4, // outer circle
		3,4, 3,5, 3,6, 3,7, 3,8, 3,9 // center
	],
	numSegments = segments.length,
	triangles = [
		0,1,2, 1,2,4, 2,4,5, // "head"
		3,4,5, 3,5,6, 3,6,7, 3,7,8, 3,8,9, 3,9,4
	],
	triangleColors = [
		"#33373b", "#535659", "#a5a7a9",
		"#ffffff", "#7eb0b3", "#459a9b", "#21b04a", "#f69439", "#e3679a"
	],
	numTriangles = triangles.length,
	touches = [],
	touchPool = [],
	mouseID = -1000,
	velocities = [],
	lineSize = 5,
	centerRadius = 27,
	inertia=.88,
	context,
	assets,
	sound = true,
	buffers;

function checkMP3Support() {
	var a = document.createElement('audio');
	return !!(a.canPlayType && a.canPlayType('audio/mp3;').replace(/no/, ''));
	//return a.canPlayType("audio/ogg")==="";
}

window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || 0;

try {
	context = new AudioContext();
	assets = new BufferLoader(context, 
			checkMP3Support()?[
				"assets/sounds/bd_boom.wav",
				"assets/sounds/snap.wav",
				"assets/sounds/bd_boost.wav",
				"assets/sounds/bassfat.wav",
				"assets/sounds/snare.wav",
				"assets/sounds/synth.wav",
				"assets/sounds/non_shit.wav",
				"assets/sounds/perc.wav",
				"assets/sounds/non_hey.wav"
			]:[
				"assets/sounds/bd_boom.ogg",
				"assets/sounds/snap.ogg",
				"assets/sounds/bd_boost.ogg",
				"assets/sounds/bassfat.ogg",
				"assets/sounds/snare.ogg",
				"assets/sounds/synth.ogg",
				"assets/sounds/non_shit.ogg",
				"assets/sounds/perc.ogg",
				"assets/sounds/non_hey.ogg"
			]
		, init );
	assets.load();
} catch(e) {
	alert("Silent mode enabled.\n\nPlease consider using a browser that supports the Web Audio API\nto experience the audio part of this demo.");
	sound = false;
	init();
}


/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
// INITIALISATION
/////////////////////////////////////////////////////////////////	
function init(bufferList) {
	if ( sound ) buffers = bufferList;
	else buffers = [1,1,1,1,1,1,1,1,1];

	// remove the "loading" message
	b.removeChild( d.getElementById("loading") );

	// watch for the window to resize
	onResize();
	w.addEventListener("resize",onResize,false);

	// Prepare data for rendering and interactions
	for(i=0,n=numPoints;i<n;i+=2){
		// scale point positions

		points[i] = stepX;
		origins[i]*=stepX;
		points[i+1] = stepY * 5;
		origins[i+1] *=stepY;
		// initialize velocity values
		if ( i == 6 ) {
			velocities[i]=0;
			velocities[i+1]=0;
		}else {
			velocities[i] = Math.random()*80-40;
			velocities[i+1] = Math.random()*80-40;
		}
	}

	// watch user actions
	initListeners();

	// render a first frame and request animation frame
	render();
	requestAnimationFrame(animate);

	window.scrollTo(0,0);

	playSound(buffers[8],0);
}

function animate(){
	requestAnimationFrame(animate);  // subscribe for the next frame
	if ( fluid ) evolve();  // make the points move
	render();  // draw on screen
}


/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
// USER INPUTS HANDLING
/////////////////////////////////////////////////////////////////	
function initListeners(){
	d.addEventListener("mousedown",onMouseDown,false);

	d.addEventListener("touchstart",onTouchStart,false);
	d.addEventListener("touchmove",onTouchMove,false);
	d.addEventListener("touchend",onTouchEnd,false);
	d.addEventListener("touchcancel",onTouchEnd,false);
}

//// MOUSE /////////////////
function onMouseDown(e){
	if ( checkActionOnLink(e) ) return;
	t = getTouch(e.pageX,e.pageY,mouseID);
	touches.push(t);
	impulseAt(t.x,t.y,12);
	hitTestTriangles(t);
	document.addEventListener("mousemove",onMouseMove,false);
	document.addEventListener("mouseup",onMouseUp,false);
	e.preventDefault();
}

function onMouseMove(e){
	t = touches[0];
	t.x = e.pageX;
	t.y = e.pageY;
	hitTestTriangles(t)
	e.preventDefault();
}

function onMouseUp(e){
	if ( touches[0].source ) stopSound(touches[0].source);
	releaseTouch(touches.pop());
	document.removeEventListener("mousemove",onMouseMove,false);
	document.removeEventListener("mouseup",onMouseUp,false);
	e.preventDefault();
}

//// TOUCH /////////////////
function onTouchStart(e){
	if ( checkActionOnLink(e) ) return;
	var ts = e.changedTouches,
		nts = ts.length,
		tc,t;

	for(j=0;j<nts;j++){
		tc = ts[j];
		t = getTouch(tc.pageX,tc.pageY,tc.identifier);
		touches.push(t);
		impulseAt(t.x,t.y,12);
		hitTestTriangles(t);
	}

	e.preventDefault();
}

function onTouchMove(e){
	var ts = e.changedTouches,
		nts = ts.length,
		tc,j, i, n=touches.length;
	for(j=0;j<nts;j++){
		tc = ts[j];
		for(i=0;i<n;i++){
			if (touches[i].id == tc.identifier ) {
				t = touches[i];
				t.x = tc.pageX;
				t.y = tc.pageY;
				hitTestTriangles(t);
				break;
			}
		}
	}
	
	e.preventDefault();
}

function onTouchEnd(e){
	var ts = e.changedTouches,
		nts = ts.length,
		tc,j, i, n=touches.length;
	for(j=0;j<nts;j++){
		tc = ts[j];
		for(i=0;i<n;i++){
			if (touches[i].id == tc.identifier ) {
				if ( touches[i].source ) stopSound(touches[i].source);
				releaseTouch( touches.splice(i,1) );
				break;
			}
		}
	}
	e.preventDefault();
}

function checkActionOnLink(e){
	if ( e.target.nodeName=="IMG" || e.target.nodeName=="A" ) {
		switch( e.target.id ) {
			case "menu-button": 
				menu.classList.toggle("open");
				e.preventDefault();
				break;
			case "setRigid":
				fluid=false;
				e.target.classList.remove("disabled");
				document.getElementById("setFluid").classList.add("disabled");
				break;
			case "setFluid":
				fluid=true;
				e.target.classList.remove("disabled");
				document.getElementById("setRigid").classList.add("disabled");
				break;
			case "trailsOn":
				trails=true;
				e.target.classList.remove("disabled");
				document.getElementById("trailsOff").classList.add("disabled");
				break;
			case "trailsOff":
				trails=false;
				e.target.classList.remove("disabled");
				document.getElementById("trailsOn").classList.add("disabled");
				break;
		}
		return true;
	}
	return false;
}

/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
// ANIMATION MANAGEMENT
/////////////////////////////////////////////////////////////////	
function evolve(){
	for(i=0,n=numPoints;i<n;i++){
		velocities[i] += ( origins[i] - points[i] ) * .1;
		points[i] += (velocities[i] *= inertia);
	}
}

function impulseAt(x,y,strength){
	if ( !fluid ) return;
	x -= offsetX;
	y -= offsetY;
	for(i=0,n=numPoints;i<n;i+=2){
		dx = points[i] - x;
		dy = points[i+1] - y;
		d = Math.sqrt(dx*dx+dy*dy);
		if ( d < 400 ) {
			dx /= d;
			dy /= d;
			d = (400-d)/400;
			d = (d*d) * strength;
			velocities[i] += dx * d;
			velocities[i+1] += dy * d;
		}
	}
}


/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
// WINDOW RESIZE
/////////////////////////////////////////////////////////////////	
function onResize(){
	// store values
	sw = w.innerWidth;
	sh = w.innerHeight;
	// resize canvas
	c.width = sw;
	c.height = sh;
	// compute steps and offset
	var scale = Math.min( sw / (4*132), sh / (9*76) );
	
	if ( scale < 1 ){
		stepX = 132 * scale;
		stepY = 76 * scale;
		lineSize = 5 * scale;
		centerRadius = 27 * scale;
	}
	offsetX = (sw - 2*stepX) >> 1;
	offsetY = (sh - 7*stepY) >> 1;

	w.scrollTo(0,0);
}


/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
// TRIANGLE HIT TEST DETECTION
/////////////////////////////////////////////////////////////////	
function sameSide(p1x,p1y,p2x,p2y,ax,ay,bx,by){
	// diff.crossproduct(diff) * diff.crossproduct(diff) -- brain hurts here...
	// tells if two points are on the same side of a segment. 
	// needed three times to test position inside the triangle
	return ( (bx-ax) * (p1y-ay) - (by-ay) * (p1x-ax) ) * ( (bx-ax) * (p2y-ay) - (by-ay) * (p2x-ax) ) >= 0;
}

function hitTestTriangles(touch){
	var x = touch.x - offsetX,
		y = touch.y - offsetY,
		ax, ay, bx, by, cx, cy, valid;

	for(i=0,n=numTriangles;i<n;i+=3){
		valid = true;
		ax = points[ (triangles[ i ]<<1)   ];
		ay = points[ (triangles[ i ]<<1)+1 ];
		bx = points[ (triangles[i+1]<<1)   ];
		by = points[ (triangles[i+1]<<1)+1 ];
		cx = points[ (triangles[i+2]<<1)   ];
		cy = points[ (triangles[i+2]<<1)+1 ];

		if ( sameSide(x,y,ax,ay,bx,by,cx,cy) && sameSide(x,y,bx,by,ax,ay,cx,cy) && sameSide(x,y,cx,cy,ax,ay,bx,by) ) {
			if ( touch.triangle != i ) {
				touch.triangle = i;
				if ( touch.source ) stopSound(touch.source);
				touch.source = playSound(buffers[i/3],0);
			}
			return;
		}
	}
	if (touch.source ) stopSound(touch.source);
	touch.triangle = -1;
}


/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
// RENDERING FUNTIONS
/////////////////////////////////////////////////////////////////	
function render() {
	if(trails){
		ctx.fillStyle = "rgba(38,41,48,0.35)"
		ctx.fillRect(0,0,sw,sh);
	}else{
		ctx.clearRect(0,0,sw,sh);
	}


	ctx.save();
	ctx.translate(offsetX,offsetY);

	var touched = false,i,n;
	for(i=0,n=touches.length;i<n;i++){
		t = touches[i];
		impulseAt(t.x,t.y,8);
		if ( t.triangle > -1 ) {
			touched = true;
			ctx.fillStyle = triangleColors[t.triangle/3];
			ctx.beginPath();
			ctx.moveTo( points[(triangles[ t.triangle ]<<1)  ], points[(triangles[ t.triangle ]<<1)+1] );
			ctx.lineTo( points[(triangles[t.triangle+1]<<1)  ], points[(triangles[t.triangle+1]<<1)+1] );
			ctx.lineTo( points[(triangles[t.triangle+2]<<1)  ], points[(triangles[t.triangle+2]<<1)+1] );
			ctx.fill();
		}
	}

	if(touched){
		// DRAW OUTLINE 
		ctx.strokeStyle = "#FFFFFF";
		ctx.lineWidth = lineSize;
		ctx.lineCap = "round";
		ctx.lineJoin ="round";
		ctx.miterLimit = 2;
		ctx.beginPath();
		for(i=0,n=numSegments;i<n;i+=2){
			drawLine(segments[i],segments[i+1]);
		}
		ctx.stroke();
		
		// inner circle
		ctx.fillStyle = "#262930";
		ctx.beginPath();
		ctx.arc(points[6],points[6+1],centerRadius,0,Math.PI*2,true);
		ctx.fill();
		ctx.stroke();
	}else{
		// DRAW TRIANGLES
		for(i=0,n=numTriangles;i<n;i+=3){
			ctx.fillStyle = triangleColors[i/3];
			ctx.beginPath();
			ctx.moveTo( points[(triangles[ i ]<<1)  ], points[(triangles[ i ]<<1)+1] );
			ctx.lineTo( points[(triangles[i+1]<<1)  ], points[(triangles[i+1]<<1)+1] );
			ctx.lineTo( points[(triangles[i+2]<<1)  ], points[(triangles[i+2]<<1)+1] );
			ctx.fill();
			
		}
		// inner circle
		ctx.fillStyle = "#262930";
		ctx.beginPath();
		ctx.arc(points[6],points[6+1],centerRadius,0,Math.PI*2,true);
		ctx.fill();
	}

	ctx.restore();
}

function drawLine( p1, p2 ) {
	p1 = p1 << 1;
	p2 = p2 << 1;
	ctx.moveTo( points[p1], points[p1+1] );
	ctx.lineTo( points[p2], points[p2+1] );
}


/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
// WEB AUDIO STUFF
/////////////////////////////////////////////////////////////////	
function playSound(buffer, time) {
	if(sound){
		var source = context.createBufferSource();
		source.buffer = buffer;
		source.connect(context.destination);
		("noteOn" in source)?source.noteOn(time):source.start(time);
		return source;
	}
	return true;
}

function stopSound(source){
	if(sound)
		("noteOff" in source)?source.noteOff(0):source.stop(0);
}


/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
// POOLING
/////////////////////////////////////////////////////////////////	
function getTouch(x,y,id){
	if ( touchPool.length ) {
		var t = touchPool.pop();
		t.x = x;
		t.y = y;
		t.id = id;
		t.triangle = -1;
		t.source = null;
		return t;
	}
	return {x: x, y:y, id:id, triangle: -1};
}

function releaseTouch(t){
	touchPool.push(t);
}
})(window,document,document.body);
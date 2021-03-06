/*
* https://threejs.org/examples/#webgl_animation_skinning_additive_blending
* https://github.com/jeromeetienne
*/

import * as THREE           from './three.module.js';
import Stats                from './stats.module.js';
import { VirtualJoystick }  from './virtualjoystick.js';
import { OrbitControls }    from './OrbitControls.js';
import { GLTFLoader }       from './GLTFLoader.js';

let scene, renderer, camera, stats;
let model, skeleton, mixer, clock;


const crossFadeControls = [];

let currentBaseAction = 'idle';
const allActions = [];
const baseActions = {
    idle: { weight: 1 },
    walk: { weight: 0 },
    run: { weight: 0 }
};
const additiveActions = {
    sneak_pose: { weight: 0 },
    sad_pose: { weight: 0 },
    agree: { weight: 0 },
    headShake: { weight: 0 }
};
let numAnimations;

var joystick = new VirtualJoystick({
            mouseSupport: true,
            stationaryBase: true,
            baseX: 200,
            baseY: 200,
            limitStickTravel: true,
            stickRadius: 50
});

init();

function init() {

    const container = document.getElementById( 'container' );
    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xa0a0a0 );
    scene.fog = new THREE.Fog( 0xa0a0a0, 10, 50 );

    const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
    hemiLight.position.set( 0, 20, 0 );
    scene.add( hemiLight );

    const dirLight = new THREE.DirectionalLight( 0xffffff );
    dirLight.position.set( 3, 10, 10 );
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 2;
    dirLight.shadow.camera.bottom = - 2;
    dirLight.shadow.camera.left = - 2;
    dirLight.shadow.camera.right = 2;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 40;
    scene.add( dirLight );

    // sol

    let mesh = new THREE.Mesh( new THREE.PlaneBufferGeometry( 100, 100 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
    mesh.rotation.x = - Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add( mesh );

    const loader = new GLTFLoader();
    loader.load( './models/Xbot.glb', function ( gltf ) {

        model = gltf.scene;
        scene.add( model );

        model.traverse( function ( object ) {

            if ( object.isMesh ) object.castShadow = true;

        } );

        skeleton = new THREE.SkeletonHelper( model );
        skeleton.visible = false;
        scene.add( skeleton );

        const animations = gltf.animations;
        mixer = new THREE.AnimationMixer( model );

        numAnimations = animations.length;

        for ( let i = 0; i !== numAnimations; ++ i ) {

            let clip = animations[ i ];
            const name = clip.name;

            if ( baseActions[ name ] ) {

                const action = mixer.clipAction( clip );
                activateAction( action );
                baseActions[ name ].action = action;
                allActions.push( action );

            } else if ( additiveActions[ name ] ) {

                THREE.AnimationUtils.makeClipAdditive( clip );

                if ( clip.name.endsWith( '_pose' ) ) {

                    clip = THREE.AnimationUtils.subclip( clip, clip.name, 2, 3, 30 );

                }

                const action = mixer.clipAction( clip );
                activateAction( action );
                additiveActions[ name ].action = action;
                allActions.push( action );

            }

        }

        animate();

    } );

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    container.appendChild( renderer.domElement );

    // camera
    camera = new THREE.PerspectiveCamera( 10, window.innerWidth / window.innerHeight, 1, 100 );
    camera.position.set( 0, 1, -20 );

    const controls = new OrbitControls( camera, renderer.domElement );
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.target.set( 0, 1, 0 );
    controls.update();

    stats = new Stats();
    container.appendChild( stats.dom );

    window.addEventListener( 'resize', onWindowResize, false );
}

function activateAction( action ) {

    const clip = action.getClip();
    const settings = baseActions[ clip.name ] || additiveActions[ clip.name ];
    setWeight( action, settings.weight );
    action.play();
}

function modifyTimeScale( speed ) {

    mixer.timeScale = speed;

}

function prepareCrossFade( startAction, endAction, duration ) {

    if ( currentBaseAction === 'idle' || ! startAction || ! endAction ) {

        executeCrossFade( startAction, endAction, duration );

    } else {

        synchronizeCrossFade( startAction, endAction, duration );

    }

    // Update control colors

    if ( endAction ) {

        const clip = endAction.getClip();
        currentBaseAction = clip.name;

    } else {

        currentBaseAction = 'None';

    }

    crossFadeControls.forEach( function ( control ) {

        const name = control.property;

        if ( name === currentBaseAction ) {

            control.setActive();

        } else {

            control.setInactive();

        }

    } );

}

function synchronizeCrossFade( startAction, endAction, duration ) {

    mixer.addEventListener( 'loop', onLoopFinished );

    function onLoopFinished( event ) {

        if ( event.action === startAction ) {

            mixer.removeEventListener( 'loop', onLoopFinished );

            executeCrossFade( startAction, endAction, duration );

        }

    }

}

function executeCrossFade( startAction, endAction, duration ) {

    if ( endAction ) {

        setWeight( endAction, 1 );
        endAction.time = 0;

        if ( startAction ) {

            // Crossfade with warping

            startAction.crossFadeTo( endAction, duration, true );

        } else {

            // Fade in

            endAction.fadeIn( duration );

        }

    } else {

        // Fade out

        startAction.fadeOut( duration );

    }

}

function setWeight( action, weight ) {

    action.enabled = true;
    action.setEffectiveTimeScale( 1 );
    action.setEffectiveWeight( weight );
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {

    // Render loop

    requestAnimationFrame( animate );

    for ( let i = 0; i !== numAnimations; ++ i ) {

        const action = allActions[ i ];
        const clip = action.getClip();
        const settings = baseActions[ clip.name ] || additiveActions[ clip.name ];
        settings.weight = action.getEffectiveWeight();

    }

    const mixerUpdateDelta = clock.getDelta();
    const currentSettings = baseActions[ currentBaseAction ];
    const currentAction = currentSettings ? currentSettings.action : null;
    
    if( joystick.right() ){
        model.rotation.y = model.rotation.y - 5 * mixerUpdateDelta;    
    }
    if( joystick.left() ){
        model.rotation.y = model.rotation.y + 5 * mixerUpdateDelta;     
    }
    if( joystick.up() ){
        const action = baseActions[ 'run' ] ? baseActions[ 'run' ].action : null;
        if (currentAction !== action)
            prepareCrossFade( currentAction, action, 0.35 );       
    }
    if( joystick.down() ){
        const action = baseActions[ 'idle' ] ? baseActions[ 'idle' ].action : null;
        if (currentAction !== action)
            prepareCrossFade( currentAction, action, 0.35 );       
    }

    mixer.update( mixerUpdateDelta );

    stats.update();

    renderer.render( scene, camera );

}
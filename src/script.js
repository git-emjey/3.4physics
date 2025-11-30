import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'lil-gui'
import * as CANNON from 'cannon-es'


/**
 * Debug
 */
const gui = new dat.GUI()
const debug_object = {}


/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl')


// Scene
const scene = new THREE.Scene()


/**
 * Sounds
 */
const hit_sound = new Audio('/sounds/hit.mp3')

const play_hit_sound = (collision) =>
{
    const impact_strength = collision.contact.getImpactVelocityAlongNormal()

    if(impact_strength > 1.5)
    {
        hit_sound.volume = Math.random()
        hit_sound.currentTime = 0
        hit_sound.play()
    }
}


/**
 * Textures
 */
const textureLoader = new THREE.TextureLoader()
const cubeTextureLoader = new THREE.CubeTextureLoader()

const environmentMapTexture = cubeTextureLoader.load([
    '/textures/environmentMaps/0/px.png',
    '/textures/environmentMaps/0/nx.png',
    '/textures/environmentMaps/0/py.png',
    '/textures/environmentMaps/0/ny.png',
    '/textures/environmentMaps/0/pz.png',
    '/textures/environmentMaps/0/nz.png'
])


/**
 * Physics
 */
const physics_world = new CANNON.World()
physics_world.gravity.set(0, -9.82, 0)
physics_world.broadphase = new CANNON.SAPBroadphase(physics_world)
physics_world.allowSleep = true

const default_physics_material = new CANNON.Material("default_material")
const default_contact_material = new CANNON.ContactMaterial(
    default_physics_material,
    default_physics_material,
    {
        friction: 0.2,
        restitution: 0.6
    }
)
physics_world.defaultContactMaterial = default_contact_material

const objects_to_update = []


// Default material (Triangle)
const triangle_geometry = new THREE.ConeGeometry(1, 1, 3)
const triangle_material = new THREE.MeshStandardMaterial({
    metalness: 0.3,
    roughness: 0.4,
    envMap: environmentMapTexture,
    envMapIntensity: 0.5
})

const triangle_vertices = [
    new CANNON.Vec3(0, 0.5, 0),
    new CANNON.Vec3(1, -0.5, 0),
    new CANNON.Vec3(-1, -0.5, 0),
    new CANNON.Vec3(0, -0.5, 1)
]

const triangle_faces = [
    [0, 1, 2],
    [0, 1, 3],
    [0, 2, 3],
    [1, 2, 3]
]

const triangle_shape = new CANNON.ConvexPolyhedron({
    vertices: triangle_vertices,
    faces: triangle_faces
})

const create_triangle = (scale, position) =>
{
    const mesh = new THREE.Mesh(triangle_geometry, triangle_material)
    mesh.scale.set(scale, scale, scale)
    mesh.castShadow = true
    mesh.position.copy(position)
    scene.add(mesh)
    const body = new CANNON.Body({
        mass: 1,
        material: default_physics_material,
        shape: triangle_shape
    })
    body.position.set(position.x, position.y, position.z)
    body.has_bounced_once = false
    body.addEventListener("collide", (event) =>
    {
        play_hit_sound(event)

        if(!body.has_bounced_once)
        {
            body.has_bounced_once = true
            body.gravityScale = 0  
        }
    })
    physics_world.addBody(body)
    objects_to_update.push({ mesh, body })
}


/**
 * Floor 
 */
const floor = new THREE.Mesh(
    new THREE.CircleGeometry(5, 64),
    new THREE.MeshStandardMaterial({
        color: '#777777',
        metalness: 0.3,
        roughness: 0.4,
        envMap: environmentMapTexture,
        envMapIntensity: 0.5
    })
)
floor.receiveShadow = true
floor.rotation.x = -Math.PI * 0.5
floor.position.y = -0.5
scene.add(floor)
const floor_shape = new CANNON.Plane()
const floor_body = new CANNON.Body({
    mass: 0,
    shape: floor_shape,
    material: default_physics_material
})
floor_body.quaternion.setFromEuler(-Math.PI * 0.5, 0, 0)
floor_body.position.set(0, -0.5, 0)
physics_world.addBody(floor_body)


/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
scene.add(ambientLight)
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.position.set(5, 5, 5)
scene.add(directionalLight)


/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}
window.addEventListener("resize", () =>
{
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})


/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(-3, 3, 3)
scene.add(camera)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true


/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))


// GUI
debug_object.spawnTriangle = () =>
{
    create_triangle(
        Math.random() * 0.4 + 0.3,
        {
            x: (Math.random() - 0.5) * 4,
            y: 3,
            z: (Math.random() - 0.5) * 4
        }
    )
}
debug_object.reset = () =>
{
    for(const obj of objects_to_update) {
        physics_world.removeBody(obj.body)
        scene.remove(obj.mesh)
    }
    objects_to_update.splice(0, objects_to_update.length)
}
gui.add(debug_object, "spawnTriangle")
gui.add(debug_object, "reset")


/**
 * Animate
 */
const clock = new THREE.Clock()
let oldElapsedTime = 0

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - oldElapsedTime
    oldElapsedTime = elapsedTime

    physics_world.step(1 / 60, deltaTime, 3)

    for(const obj of objects_to_update) {
        if (obj.body.has_bounced_once) {
            obj.body.force.y += obj.body.mass * 9.82

            obj.body.applyForce(new CANNON.Vec3(0, 15, 0), obj.body.position)

            obj.body.velocity.scale(0.95, obj.body.velocity)
            obj.body.angularVelocity.scale(0.9, obj.body.angularVelocity)
        }
        obj.mesh.position.copy(obj.body.position)
        obj.mesh.quaternion.copy(obj.body.quaternion)
    }

    controls.update()
    renderer.render(scene, camera)

    window.requestAnimationFrame(tick)
}

tick()

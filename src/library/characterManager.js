import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { AnimationManager } from "./animationManager"
import { ScreenshotManager } from "./screenshotManager";
import { BlinkManager } from "./blinkManager";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { getAsArray, disposeVRM, renameVRMBones, addModelData } from "./utils";
import { downloadGLB, downloadVRMWithAvatar } from "../library/download-utils"
import { saveVRMCollidersToUserData } from "./load-utils";
import { cullHiddenMeshes, setTextureToChildMeshes } from "./utils";
import { LipSync } from "./lipsync";
import { LookAtManager } from "./lookatManager";
import { CharacterManifestData } from "./CharacterManifestData";

const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const localVector3 = new THREE.Vector3(); 

export class CharacterManager {
    constructor(options){
      this._start(options);
    }
    
    async _start(options){
      const{
        parentModel = null,
        renderCamera = null,
        createAnimationManager = true,
        manifestURL = null,
        canDownload = true
      }= options;

     

      // data that is needed, but not required to be downloaded
      this.rootModel = new THREE.Object3D();
      // all data that will be downloaded
      this.characterModel = new THREE.Object3D();

      this.parentModel = parentModel;
      if (parentModel){
        parentModel.add(this.rootModel);
      }
      this.lipSync = null;

      this.lookAtManager = null;
      this.animationManager = createAnimationManager ?  new AnimationManager() : null;
      this.screenshotManager = new ScreenshotManager();
      this.blinkManager = new BlinkManager(0.1, 0.1, 0.5, 5)
      this._setupScreenshotManager();

      this.rootModel.add(this.characterModel)
      this.renderCamera = renderCamera;

      this.canDownload = canDownload;

      this.manifestData = null;
      this.manifest = null
      if (manifestURL){
         await this.loadManifest(manifestURL)
         this.animationManager.setScale(this.manifestData.exportScale)
      }
      
      this.avatar = {};   // Holds information of traits within the avatar
      this.traitLoadManager = new TraitLoadingManager();

      // XXX actually use the vrm helper
      const helperRoot = new THREE.Group();
      helperRoot.renderOrder = 10000;
      this.rootModel.add(helperRoot)
      this.vrmHelperRoot = helperRoot;
    }

    update(){
      if (this.lookAtManager != null){
        this.lookAtManager.update();
      }
    }

    addLookAtMouse(screenPrecentage, canvasID, camera, enable = true){
      this.lookAtManager = new LookAtManager(screenPrecentage, canvasID, camera);
      this.lookAtManager.enabled = true;
      for (const prop in this.avatar){
        if (this.avatar[prop]?.vrm != null){
          this.lookAtManager.addVRM(this.avatar[prop].vrm)
        }
      }
      this.toggleCharacterLookAtMouse(enable)
    }
    toggleCharacterLookAtMouse(enable){
      if (this.lookAtManager != null){
        this.lookAtManager.setActive(enable);
        if (this.animationManager){
          this.animationManager.enableMouseLook(enable);
        }
      }
      else{
        console.warn("toggleCharacterLookAtMouse() was called, but no lookAtManager exist. Make sure to set it up first with addLookArMous()")
      }
    }
    savePortraitScreenshot(name, width, height){
      this.blinkManager.enableScreenshot();

      this.characterModel.traverse(o => {
        if (o.isSkinnedMesh) {
          const headBone = o.skeleton.bones.filter(bone => bone.name === 'head')[0];
          headBone.getWorldPosition(localVector3);
        }
      });
      localVector3.z += 0.3;
      this.screenshotManager.setCamera(localVector3, 0.83);
      this.screenshotManager.saveScreenshot(name, width,height);

      this.blinkManager.disableScreenshot();
    }

    // XXX just call raycast culling without sneding mouse position?
    cameraRaycastCulling(mouseX, mouseY, removeFace = true){
      if (this.renderCamera == null){
        console.warn("No camera was set in character manager. Please call setRenderCamera(camera) before calling this function")
        return;
      }
      // #region restore/remove existing faces logic
      const setOriginalInidicesAndColliders = () => {
        this.characterModel.traverse((child)=>{
          if (child.isMesh) {
            if (child.userData.origIndexBuffer){
              child.userData.clippedIndexGeometry = child.geometry.index.clone();
              child.geometry.setIndex(child.userData.origIndexBuffer);
            }
          }
        })
      }

      const restoreCullIndicesAndColliders = () => {
        this.characterModel.traverse((child)=>{
          if (child.isMesh) {
            if (child.userData.origIndexBuffer){
              child.geometry.setIndex(child.userData.clippedIndexGeometry);
            }
          }
        })
      }

      const checkIndicesIndex = (array, indices) =>{
        for (let i =0; i < array.length; i+=3){
          if (indices[0] != array[i]){
            continue
          }
          if (indices[1] != array[i+1]){
            continue
          }
          if (indices[2] != array[i+2]){
            continue
          }
          return i;
        }
        return -1;
      }
  
      const updateCullIndices = (intersection, removeFace) => {
        const intersectedObject = intersection.object;
        const face = intersection.face;
        const newIndices = [face.a,face.b,face.c];
        const clipIndices = intersectedObject.userData?.clippedIndexGeometry?.array
  
        
  
        if (clipIndices != null){
          const hitIndex = checkIndicesIndex(clipIndices,newIndices)
          const uint32ArrayAsArray = Array.from(clipIndices);
          if (hitIndex == -1 && !removeFace){
            const mergedIndices = [...uint32ArrayAsArray, ...newIndices];
            intersectedObject.userData.clippedIndexGeometry =  new THREE.BufferAttribute(new Uint32Array(mergedIndices),1,false);
          }
          if (hitIndex != 1 && removeFace){
            uint32ArrayAsArray.splice(hitIndex, 3);
            intersectedObject.userData.clippedIndexGeometry = new THREE.BufferAttribute(new Uint32Array(uint32ArrayAsArray), 1, false);
          }
        }
      }
      // #endregion

      mouse.x = mouseX;
      mouse.y = mouseY;

      setOriginalInidicesAndColliders();
      raycaster.setFromCamera(mouse, this.renderCamera);
      const intersects = raycaster.intersectObjects(this.characterModel.children)
      if (intersects.length > 0) {
        const intersection = intersects[0];
        updateCullIndices(intersection, removeFace)
      }
      restoreCullIndicesAndColliders();
    }

    removeCurrentCharacter(){
      const clearTraitData = []
      for (const prop in this.avatar){
        
        clearTraitData.push(new LoadedData({traitGroupID:prop, traitModel:null}))
      }
      clearTraitData.forEach(itemData => {
        this._addLoadedData(itemData)
      });
      this.avatar = {};
    }
    removeCurrentManifest(){
      this.manifest = null;
      this.manifestData = null;
      this.animationManager.clearCurrentAnimations();
    }
    downloadVRM(name, exportOptions = null){
      if (this.canDownload){
        exportOptions = exportOptions || {}
        const finalOptions = {...this.manifestData.getExportOptions(), ...exportOptions};
        finalOptions.isVrm0 = true; // currently vrm1 not supported
        // this.animationManager.setScale(this.manifestData.exportScale)
        finalOptions.screenshot = this._getPortaitScreenshotTexture(false,512,512);
        downloadVRMWithAvatar(this.characterModel, this.avatar, name, finalOptions);
      }
      else{
        console.error("Download not supported");
      }
    }
    getAvatarSelection(){
      var result = {};
      for (const prop in this.avatar) {
        result[prop] = {
          name:this.avatar[prop].name,
          id:this.avatar[prop].traitInfo?.id
        }
      }
      return result;
      
    }
    getGroupTraits(){
      if (this.manifestData){
        return this.manifestData.getGroupModelTraits();
      }
    }
    getCurrentCharacterModel(){
      return this.characterModel;
    }

    // returns wether or not the trait group can be removed
    isTraitGroupRequired(groupTraitID){
      const groupTrait = this.manifestData.getModelGroup(groupTraitID)
      if (groupTrait?.isRequired){
        return true;
      }
      return false;
    }
    
    // manifest data requests
    getTraits(groupTraitID){
      if (this.manifestData){
        return this.manifestData.getModelTraits(groupTraitID);
      }
      else{
        console.warn("No manifest file has been loaded, please load it before trait models.")
        return null;
      }
    }
    getCurrentTraitID(groupTraitID){
      return this.avatar[groupTraitID]?.traitInfo?.id;
    }
    getCurrentTraitData(groupTraitID){
      return this.avatar[groupTraitID]?.traitInfo;
    }
    getCurrentTraitVRM(groupTraitID){
      return this.avatar[groupTraitID]?.vrm;
    }
    setParentModel(model){
      model.add(this.rootModel);
      this.parentModel = model;
      if (this.screenshotManager)
        this.screenshotManager.scene =  this.parentModel;
    }
    setRenderCamera(camera){
      this.renderCamera = camera;
    }
    
    /**
     * Loads random traits based on manifest data.
     * If manifest data is available, retrieves random traits,
     * If manifest data is not available, logs an error and rejects the Promise.
     *
     * @returns {Promise<void>} A Promise that resolves with an array of random traits
     *                           if successful, or rejects with an error message if not.
     */
    loadRandomTraits() {
      return new Promise(async (resolve, reject) => {
        if (this.manifestData) {
          const randomTraits = this.manifestData.getRandomTraits();
          await this._loadTraits(randomTraits);
          resolve(); // Resolve the promise with the result
        } else {
          const errorMessage = "No manifest was loaded, random traits cannot be loaded.";
          console.error(errorMessage);
          reject(new Error(errorMessage)); // Reject the promise with an error
        }
      });
    }

    /**
     * Loads traits from an NFT using the specified URL.
     *
     * @param {string} url - The URL of the NFT to retrieve traits from.
     * @param {boolean} [fullAvatarReplace=true] - Flag indicating whether to fully replace existing traits.
     * @param {Array<string>} [ignoreGroupTraits=null] - An optional array of trait groups to ignore.
     * @returns {Promise<void>} A Promise that resolves if successful,
     *                         or rejects with an error message if not.
     */
    loadTraitsFromNFT(url, fullAvatarReplace = true, ignoreGroupTraits = null) {
      return new Promise(async (resolve, reject) => {
        try {
          // Check if manifest data is available
          if (this.manifestData) {
            // Retrieve traits from the NFT using the manifest data
            const traits = this.manifestData.getNFTraitOptionsFromURL(url, ignoreGroupTraits);

            // Load traits using the _loadTraits method
            await this._loadTraits(traits, fullAvatarReplace);

            // Resolve the Promise (without a value, as you mentioned it's not needed)
            resolve();
          } else {
            // Manifest data is not available, log an error and reject the Promise
            const errorMessage = "No manifest was loaded, NFT traits cannot be loaded.";
            console.error(errorMessage);
            reject(new Error(errorMessage));
          }
        } catch (error) {
          // Handle any asynchronous errors during trait retrieval or loading
          reject(error);
        }
      });
    }

    /**
     * Loads traits from an NFT object metadata into the avatar.
     *
     * @param {Object} NFTObject - The NFT object containing traits information.
     * @param {boolean} fullAvatarReplace - Indicates whether to replace all avatar traits.
     * @param {Array} ignoreGroupTraits - An optional array of trait groups to ignore.
     * @returns {Promise<void>} A Promise that resolves if successful,
     *                         or rejects with an error message if not.
     */
    loadTraitsFromNFTObject(NFTObject, fullAvatarReplace = true, ignoreGroupTraits = null) {
      return new Promise(async (resolve, reject) => {
        // Check if manifest data is available
        if (this.manifestData) {
          try {
            // Retrieve traits from the NFT object using manifest data
            const traits = this.manifestData.getNFTraitOptionsFromObject(NFTObject, ignoreGroupTraits);

            // Load traits into the avatar using the _loadTraits method
            await this._loadTraits(traits, fullAvatarReplace);

            resolve();
          } catch (error) {
            // Reject the Promise with an error message if there's an error during trait retrieval
            console.error("Error loading traits from NFT object:", error.message);
            reject(new Error("Failed to load traits from NFT object."));
          }
        } else {
          // Manifest data is not available, log an error and reject the Promise
          const errorMessage = "No manifest was loaded, NFT traits cannot be loaded.";
          console.error(errorMessage);
          reject(new Error(errorMessage));
        }
      });
    }

    /**
     * Loads initial traits based on manifest data.
     *
     * @returns {Promise<void>} A Promise that resolves if successful,
     *                         or rejects with an error message if not.
     */
    loadInitialTraits() {
      return new Promise(async(resolve, reject) => {
        // Check if manifest data is available
        if (this.manifestData) {
          // Load initial traits using the _loadTraits method
          await this._loadTraits(this.manifestData.getInitialTraits());

          resolve();
        } else {
          // Manifest data is not available, log an error and reject the Promise
          const errorMessage = "No manifest was loaded, initial traits cannot be loaded.";
          console.error(errorMessage);
          reject(new Error(errorMessage));
        }
      });
    }

    /**
     * Loads a specific trait based on group and trait IDs.
     *
     * @param {string} groupTraitID - The ID of the trait group.
     * @param {string} traitID - The ID of the specific trait.
     * @returns {Promise<void>} A Promise that resolves if successful,
     *                         or rejects with an error message if not.
     */
    loadTrait(groupTraitID, traitID) {
      return new Promise(async (resolve, reject) => {
        // Check if manifest data is available
        if (this.manifestData) {
          try {
            // Retrieve the selected trait using manifest data
            const selectedTrait = this.manifestData.getTraitOption(groupTraitID, traitID);

            // If the trait is found, load it into the avatar using the _loadTraits method
            if (selectedTrait) {
              await this._loadTraits(getAsArray(selectedTrait));
              resolve();
            }
          } catch (error) {
            // Reject the Promise with an error message if there's an error during trait retrieval
            console.error("Error loading specific trait:", error.message);
            reject(new Error("Failed to load specific trait."));
          }
        } else {
          // Manifest data is not available, log an error and reject the Promise
          const errorMessage = "No manifest was loaded, specific trait cannot be loaded.";
          console.error(errorMessage);
          reject(new Error(errorMessage));
        }
      });
    }

    /**
     * Loads a custom trait based on group and URL.
     *
     * @param {string} groupTraitID - The ID of the trait group.
     * @param {string} url - The URL associated with the custom trait.
     * @returns {Promise<void>} A Promise that resolves if successful,
     *                         or rejects with an error message if not.
     */
    loadCustomTrait(groupTraitID, url) {
      return new Promise(async (resolve, reject) => {
        // Check if manifest data is available
        if (this.manifestData) {
          try {
            // Retrieve the selected custom trait using manifest data
            const selectedTrait = this.manifestData.getCustomTraitOption(groupTraitID, url);

            // If the custom trait is found, load it into the avatar using the _loadTraits method
            if (selectedTrait) {
              await this._loadTraits(getAsArray(selectedTrait));
              resolve();
            }

          } catch (error) {
            // Reject the Promise with an error message if there's an error during custom trait retrieval
            console.error("Error loading custom trait:", error.message);
            reject(new Error("Failed to load custom trait."));
          }
        } else {
          // Manifest data is not available, log an error and reject the Promise
          const errorMessage = "No manifest was loaded, custom trait cannot be loaded.";
          console.error(errorMessage);
          reject(new Error(errorMessage));
        }
      });
    }

    /**
     * Loads a custom texture to the specified group trait's model.
     *
     * @param {string} groupTraitID - The ID of the group trait.
     * @param {string} url - The URL of the custom texture.
     * @returns {Promise<void>} A Promise that resolves when the texture is successfully loaded,
     *                         or rejects with an error message if the group trait is not found.
     */
    loadCustomTexture(groupTraitID, url) {
      return new Promise(async (resolve, reject) => {
        const model = this.avatar[groupTraitID]?.model;

        if (model) {
          // Set the texture to child meshes of the model
          await setTextureToChildMeshes(model, url);

          // Resolve the Promise (without a value, as you mentioned it's not needed)
          resolve();
        } else {
          // Group trait not found, log a warning and reject the Promise
          const errorMessage = "No Group Trait with name " + groupTraitID + " was found.";
          console.warn(errorMessage);
          reject(new Error(errorMessage));
        }
      });
    }


    removeTrait(groupTraitID, forceRemove = false){
      if (this.isTraitGroupRequired(groupTraitID) && !forceRemove){
        console.warn(`No trait with name: ${ groupTraitID } is not removable.`)
        return;
      }

      const groupTrait = this.manifestData.getModelGroup(groupTraitID);
      if (groupTrait){
        const itemData = new LoadedData({traitGroupID:groupTraitID, traitModel:null})
        this._addLoadedData(itemData);
        cullHiddenMeshes(this.avatar);
      }
      else{
        console.warn(`No trait with name: ${ groupTraitID } was found.`)
      }
    }
    updateCullHiddenMeshes(){
      cullHiddenMeshes(this.avatar);
    }
    loadOptimizerManifest(){
      this.manifest = {colliderTraits:["CUSTOM"],traits:[{name:"Custom", trait:"CUSTOM", collection:[]}]};
      this.manifestData = new CharacterManifestData(this.manifest);
    }
    getCurrentOptimizerCharacterModel(){
      return this.avatar["CUSTOM"]?.vrm;
    }

    /**
     * Loads an optimized character based on a custom trait URL.
     *
     * @param {string} url - The URL associated with the custom trait.
     * @returns {Promise<void>} A Promise that resolves if successful,
     *                         or rejects with an error message if not.
     */
    loadOptimizerCharacter(url) {
      return this.loadCustomTrait("CUSTOM", url);
    }
    async loadManifest(url){
      this.manifest = await this._fetchManifest(url)
      if (this.manifest){
        this.manifestData = new CharacterManifestData(this.manifest);
        if (this.animationManager)
          await this._animationManagerSetup(this.manifest.animationPath, this.manifest.assetsLocation, this.manifestData.exportScale)
      }
    }
    // 
    async _loadTraits(options, fullAvatarReplace = false){
      await this.traitLoadManager.loadTraitOptions(getAsArray(options)).then(loadedData=>{
        if (fullAvatarReplace){
          // add null loaded options to existingt traits to remove them;
          const groupTraits = this.getGroupTraits();
          groupTraits.forEach((trait) => {
            const coincidence = loadedData.some((option) => option.traitModel?.traitGroup.trait === trait.trait);
            if (!coincidence) {
              if (this.avatar[trait.trait] != null){
                loadedData.push(new LoadedData({traitGroupID:trait.trait, traitModel:null}));
              }
            }
          });
        }
        
        loadedData.forEach(itemData => {
            this._addLoadedData(itemData)
        });
        cullHiddenMeshes(this.avatar);
      })
    }
    async _animationManagerSetup(paths, baseLocation, scale){
      const animationPaths = getAsArray(paths);
      if (this.animationManager){
        this.animationManager.setScale(scale);
        if (paths.length > 0){
          this.animationManager.storeAnimationPaths(animationPaths, baseLocation || "");
          await this.animationManager.loadAnimation(animationPaths, animationPaths[0].endsWith('.fbx'), baseLocation || "")
        }
      }
    }

    // XXX check if we caqn move this code only to manifestData
    async _fetchManifest(location) {
        const response = await fetch(location)
        const data = await response.json()
        return data
    }

    _getPortaitScreenshotTexture(getBlob, width, height){
      this.blinkManager.enableScreenshot();

      this.characterModel.traverse(o => {
        if (o.isSkinnedMesh) {
          const headBone = o.skeleton.bones.filter(bone => bone.name === 'head')[0];
          headBone.getWorldPosition(localVector3);
        }
      });
      // XXX save variables in manifest to store face distance and field of view.
      localVector3.z += 0.3;
      this.screenshotManager.setCamera(localVector3, 0.83);
      const screenshot = getBlob ? 
        this.screenshotManager.getScreenshotBlob(width, height):
        this.screenshotManager.getScreenshotTexture(width, height);

      this.blinkManager.disableScreenshot();
      return screenshot;
    }
    _setupScreenshotManager(){
      if (this.parentModel)
        this.screenshotManager.scene = this.parentModel;
      else
        this.screenshotManager.scene = this.rootModel;
    }
    _setupWireframeMaterial(mesh){
      // Set Wireframe material with random colors for each material the object has
      mesh.origMat = mesh.material;

      const getRandomColor = ()  => {
        const minRGBValue = 0.1; // Minimum RGB value to ensure colorful colors
        const r = minRGBValue + Math.random() * (1 - minRGBValue);
        const g = minRGBValue + Math.random() * (1 - minRGBValue);
        const b = minRGBValue + Math.random() * (1 - minRGBValue);
        return new THREE.Color(r, g, b);
      }

      const debugMat = new THREE.MeshBasicMaterial( {
                    color: getRandomColor(),
                    wireframe: true,
        wireframeLinewidth:0.2
                } );

      const origMat = mesh.material;
      mesh.setDebugMode = (debug) => { 
        if (debug){
          if (mesh.material.length){
            mesh.material[0] = debugMat;
            mesh.material[1] = debugMat;
          }
          else{
            mesh.material = debugMat;
          }
        }
        else{
          mesh.material = origMat;
        }
      }

      // if (debugMode){
      //   mesh.setDebugMode(true);
      // }
      
    }
    _VRMBaseSetup(m, item, traitID, textures, colors){
      let vrm = m.userData.vrm;
      addModelData(vrm, {isVRM0:vrm.meta?.metaVersion === '0'})

      if (this.manifestData.isColliderRequired(traitID))
        saveVRMCollidersToUserData(m);
      
      renameVRMBones(vrm);
      
      if (this.manifestData.isLipsyncTrait(traitID))
        this.lipSync = new LipSync(vrm);


      this._modelBaseSetup(vrm, item, traitID, textures, colors);

      // Rotate model 180 degrees
      if (vrm.meta?.metaVersion === '0'){
        vrm.scene.traverse((child) => {
          if (child.isSkinnedMesh) {
          
              VRMUtils.rotateVRM0( vrm );
              console.log("Loaded VRM0 file ", vrm);
              for (let i =0; i < child.skeleton.bones.length;i++){
                child.skeleton.bones[i].userData.vrm0RestPosition = { ... child.skeleton.bones[i].position }
              }
              child.userData.isVRM0 = true;
          }
        })
      }

      return vrm;
    }
    _modelBaseSetup(model, item, traitID, textures, colors){

      const meshTargets = [];
      const cullingIgnore = getAsArray(item.cullingIgnore)
      const cullingMeshes = [];

      // Mesh target setup section
      // XXX Separate from this part
      if (item.meshTargets){
        getAsArray(item.meshTargets).map((target) => {
          const mesh = model.scene.getObjectByName ( target )
          if (mesh?.isMesh) meshTargets.push(mesh);
        })
      }

      model.scene.traverse((child) => {
        
        // mesh target setup secondary swection
        if (!item.meshTargets && child.isMesh) meshTargets.push(child);

        // basic setup
        child.frustumCulled = false
        if (child.isMesh) {

          // XXX Setup MToonMaterial for shader

          this._setupWireframeMaterial(child);

          // if (child.material.length){
          //   effectManager.setCustomShader(child.material[0]);
          //   effectManager.setCustomShader(child.material[1]);
          // }
          // else{
          //   effectManager.setCustomShader(child.material);
          // }

          // if a mesh is found in name to be ignored, dont add it to target cull meshes
          if (cullingIgnore.indexOf(child.name) === -1)
            cullingMeshes.push(child)
          
        }
      })

      const templateInfo = this.manifest;

      const trait = this.manifestData.getModelGroup(traitID);
      // culling layers setup section
      addModelData(model, {
        cullingLayer: 
          item.cullingLayer != null ? item.cullingLayer: 
          trait.cullingLayer != null ? trait.cullingLayer: 
          templateInfo.defaultCullingLayer != null?templateInfo.defaultCullingLayer: -1,
        cullingDistance: 
          item.cullingDistance != null ? item.cullingDistance: 
          trait.cullingDistance != null ? trait.cullingDistance:
          templateInfo.defaultCullingDistance != null ? templateInfo.defaultCullingDistance: null,
        maxCullingDistance:
          item.maxCullingDistance != null ? item.maxCullingDistance: 
          trait.maxCullingDistance != null ? trait.maxCullingDistance:
          templateInfo.maxCullingDistance != null ? templateInfo.maxCullingDistance: Infinity,
        cullingMeshes
      })  

      // once the setup is done, assign texture to meshes
      meshTargets.map((mesh, index)=>{
          
        if (textures){
          const txt = textures[index] || textures[0]
          if (txt != null){
            //const mat = mesh.material.length ? mesh.material[0] : 
            mesh.material[0].map = txt
            mesh.material[0].shadeMultiplyTexture = txt
          }
        }
        if (colors){
          const col = colors[index] || colors[0]
          if (col != null){
            mesh.material[0].uniforms.litFactor.value = col
            mesh.material[0].uniforms.shadeColorFactor.value = new THREE.Color( col.r*0.8, col.g*0.8, col.b*0.8 )
          }
        }
      })
    }
    _applyManagers(vrm){
  
        this.blinkManager.addBlinker(vrm)

        if (this.lookAtManager)
          this.lookAtManager.addVRM(vrm);

        // Animate this VRM 
        if (this.animationManager)
          this.animationManager.startAnimation(vrm)
    }
    _displayModel(model){
      if(model) {
        // call transition
        const m = model.scene;
        //m.visible = false;
        // add the now model to the current scene
        
        this.characterModel.attach(m)
        //animationManager.update(); // note: update animation to prevent some frames of T pose at start.


        // setTimeout(() => {
        //   // update the joint rotation of the new trait
        //   const event = new Event('mousemove');
        //   event.x = mousePosition.x;
        //   event.y = mousePosition.y;
        //   window.dispatchEvent(event);

        //   m.visible = true;

        //   // play transition effect
        //   if (effectManager.getTransitionEffect('switch_item')) {
        //     effectManager.playSwitchItemEffect();
        //     // !isMute && playSound('switchItem');
        //   }
        //   else {
        //     effectManager.playFadeInEffect();
        //   } 
        // }, effectManager.transitionTime)
      }
    }
    _positionModel(model){
      const scale = this.manifestData.exportScale;
        model.scene.scale.set(scale,scale,scale);

      // Move depending on manifest definition
      // const offset = templateInfo.offset;
      // if (offset != null)
      //   model.scene.position.set(offset[0],offset[1],offset[2]);
    }
    _addLoadedData(itemData){
      const {
          traitGroupID,
          traitModel,
          textureTrait,
          colorTrait,
          models,
          textures,
          colors
      } = itemData;

      // user selected to remove trait
      if (traitModel == null){
          if ( this.avatar[traitGroupID] && this.avatar[traitGroupID].vrm ){
              // just dispose for now
              disposeVRM(this.avatar[traitGroupID].vrm)
              this.avatar[traitGroupID] = {}
              // XXX restore effects without setTimeout
          }
          return;
      }

      let vrm = null;

      models.map((m)=>{
          
          vrm = this._VRMBaseSetup(m, traitModel, traitGroupID, textures, colors);

      })

      // If there was a previous loaded model, remove it (maybe also remove loaded textures?)
      if (this.avatar[traitGroupID] && this.avatar[traitGroupID].vrm) {
        disposeVRM(this.avatar[traitGroupID].vrm)
        // XXX restore effects
      }

      this._positionModel(vrm)
    
      this._displayModel(vrm)
        
      this._applyManagers(vrm)
      // and then add the new avatar data
      // to do, we are now able to load multiple vrm models per options, set the options to include vrm arrays
      this.avatar[traitGroupID] = {
        traitInfo: traitModel,
        textureInfo: textureTrait,
        colorInfo: colorTrait,
        name: traitModel.name,
        model: vrm && vrm.scene,
        vrm: vrm
      }
    }



   
}

// Class to load traits
class TraitLoadingManager{
    constructor(){
        // Main loading manager
        const loadingManager = new THREE.LoadingManager();
        loadingManager.onProgress = (url, loaded, total) => {
            this.setLoadPercentage(Math.round(loaded / total * 100));
        };

        // Models Loader
        const gltfLoader = new GLTFLoader(loadingManager);
        gltfLoader.crossOrigin = 'anonymous';
        gltfLoader.register((parser) => {
            // return new VRMLoaderPlugin(parser, {autoUpdateHumanBones: true, helperRoot:vrmHelperRoot})
            // const springBoneLoader = new VRMSpringBoneLoaderPlugin(parser);
            // return new VRMLoaderPlugin(parser, {autoUpdateHumanBones: true, springBonePlugin:springBoneLoader})
            return new VRMLoaderPlugin(parser, {autoUpdateHumanBones: true})
        })
      
        // Texture Loader
        const textureLoader = new THREE.TextureLoader(loadingManager);

        this.loadPercentager = 0;
        this.loadingManager = loadingManager;
        this.gltfLoader = gltfLoader;
        this.textureLoader = textureLoader;

        this.isLoading = false;
    }
    setLoadPercentage(value){
        this.loadPercentager = value;
    }


    // options as SelectedOptions class
    // Loads an array of trait options and returns a promise that resolves as an array of Loaded Data
    loadTraitOptions(options) {
        return new Promise((resolve) => {
            this.isLoading = true;
            const resultData = [];
    
            const promises = options.map(async (option, index) => {
                if (option == null) {
                    resultData[index] = null;
                    return;
                }

                const loadedModels = await Promise.all(
                    getAsArray(option?.traitModel?.fullDirectory).map(async (modelDir) => {
                        try {
                            return await this.gltfLoader.loadAsync(modelDir);
                        } catch (error) {
                            console.error(`Error loading model ${modelDir}:`, error);
                            return null;
                        }
                    })
                );
    
                const loadedTextures = await Promise.all(
                  getAsArray(option?.traitTexture?.fullDirectory).map(
                      (textureDir) =>
                          new Promise((resolve) => {
                              this.textureLoader.load(textureDir, (txt) => {
                                  txt.flipY = false;
                                  resolve(txt);
                              });
                          })
                  )
                );
    
                const loadedColors = getAsArray(option?.traitColor?.value).map((colorValue) => new THREE.Color(colorValue));
    
                resultData[index] = new LoadedData({
                    traitGroupID: option?.traitModel.traitGroup.trait,
                    traitModel: option?.traitModel,
                    textureTrait: option?.traitTexture,
                    colorTrait: option?.traitColor,
                    models: loadedModels,
                    textures: loadedTextures,
                    colors: loadedColors,
                });
            });
    
            Promise.all(promises)
                .then(() => {
                    this.setLoadPercentage(100); // Set progress to 100% once all assets are loaded
                    resolve(resultData);
                    this.isLoading = false;
                })
                .catch((error) => {
                    console.error('An error occurred:', error);
                    resolve(resultData);
                    this.isLoading = false;
                });
        });
    }
}
class LoadedData{
    constructor(data){
        const {
            traitGroupID,
            traitModel,
            textureTrait,
            colorTrait,
            models,
            textures,
            colors
        } = data;

        // Option base data
        this.traitGroupID = traitGroupID;
        this.traitModel = traitModel;
        this.textureTrait = textureTrait;
        this.colorTrait = colorTrait;

        // Option loaded data
        this.models = models;
        this.textures = textures;
        this.colors = colors;
    }
}



//  const getRestrictions = () => {

//     const traitRestrictions = templateInfo.traitRestrictions // can be null
//     const typeRestrictions = {};

//     for (const prop in traitRestrictions){

//       // create the counter restrcitions traits
//       getAsArray(traitRestrictions[prop].restrictedTraits).map((traitName)=>{

//         // check if the trait restrictions exists for the other trait, if not add it
//         if (traitRestrictions[traitName] == null) traitRestrictions[traitName] = {}
//         // make sure to have an array setup, if there is none, create a new empty one
//         if (traitRestrictions[traitName].restrictedTraits == null) traitRestrictions[traitName].restrictedTraits = []

//         // finally merge existing and new restrictions
//         traitRestrictions[traitName].restrictedTraits = [...new Set([
//           ...traitRestrictions[traitName].restrictedTraits ,
//           ...[prop]])]  // make sure to add prop as restriction
//       })

//       // do the same for the types
//       getAsArray(traitRestrictions[prop].restrictedTypes).map((typeName)=>{
//         //notice were adding the new data to typeRestrictions and not trait
//         if (typeRestrictions[typeName] == null) typeRestrictions[typeName] = {}
//         //create the restricted trait in this type
//         if (typeRestrictions[typeName].restrictedTraits == null) typeRestrictions[typeName].restrictedTraits = []

//         typeRestrictions[typeName].restrictedTraits = [...new Set([
//           ...typeRestrictions[typeName].restrictedTraits ,
//           ...[prop]])]  // make sure to add prop as restriction
//       })
//     }

//     // now merge defined type to type restrictions
//     for (const prop in templateInfo.typeRestrictions){
//       // check if it already exsits
//       if (typeRestrictions[prop] == null) typeRestrictions[prop] = {}
//       if (typeRestrictions[prop].restrictedTypes == null) typeRestrictions[prop].restrictedTypes = []
//       typeRestrictions[prop].restrictedTypes = [...new Set([
//         ...typeRestrictions[prop].restrictedTypes ,
//         ...getAsArray(templateInfo.typeRestrictions[prop])])]  

//       // now that we have setup the type restrictions, lets counter create for the other traits
//       getAsArray(templateInfo.typeRestrictions[prop]).map((typeName)=>{
//         // prop = boots
//         // typeName = pants
//         if (typeRestrictions[typeName] == null) typeRestrictions[typeName] = {}
//         if (typeRestrictions[typeName].restrictedTypes == null) typeRestrictions[typeName].restrictedTypes =[]
//         typeRestrictions[typeName].restrictedTypes = [...new Set([
//           ...typeRestrictions[typeName].restrictedTypes ,
//           ...[prop]])]  // make sure to add prop as restriction
//       })
//     }

    // _filterRestrictedOptions(options){
    //     let removeTraits = [];
    //     for (let i =0; i < options.length;i++){
    //       const option = options[i];
          
    //      //if this option is not already in the remove traits list then:
    //      if (!removeTraits.includes(option.trait.name)){
    //         const typeRestrictions = restrictions?.typeRestrictions;
    //         // type restrictions = what `type` cannot go wit this trait or this type
    //         if (typeRestrictions){
    //           getAsArray(option.item?.type).map((t)=>{
    //             //combine to array
    //             removeTraits = [...new Set([
    //               ...removeTraits , // get previous remove traits
    //               ...findTraitsWithTypes(getAsArray(typeRestrictions[t]?.restrictedTypes)),  //get by restricted traits by types coincidence
    //               ...getAsArray(typeRestrictions[t]?.restrictedTraits)])]  // get by restricted trait setup
    
    //           })
    //         }
    
    //         // trait restrictions = what `trait` cannot go wit this trait or this type
    //         const traitRestrictions = restrictions?.traitRestrictions;
    //         if (traitRestrictions){
    //           removeTraits = [...new Set([
    //             ...removeTraits,
    //             ...findTraitsWithTypes(getAsArray(traitRestrictions[option.trait.name]?.restrictedTypes)),
    //             ...getAsArray(traitRestrictions[option.trait.name]?.restrictedTraits),
    
    //           ])]
    //         }
    //       }
    //     }
    
    //     // now update uptions
    //     removeTraits.forEach(trait => {
    //       let removed = false;
    //       updateCurrentTraitMap(trait, null);
          
    //       for (let i =0; i < options.length;i++){
    //         // find an option with the trait name 
    //         if (options[i].trait?.name === trait){
    //           options[i] = {
    //             item:null,
    //             trait:templateInfo.traits.find((t) => t.name === trait)
    //           }
    //           removed = true;
    //           break;
    //         }
    //       }
    //       // if no option setup was found, add a null option to remove in case user had it added before
    //       if (!removed){
    //         options.push({
    //           item:null,
    //           trait:templateInfo.traits.find((t) => t.name === trait)
    //         })
    //       }
    //     });
       
    //     return options;
    // }

        // const findTraitsWithTypes = (types) => {
        //   const typeTraits = [];
        //   for (const prop in avatar){
        //     for (let i = 0; i < types.length; i++){
        //       const t = types[i]
            
        //       if (avatar[prop].traitInfo?.type?.includes(t)){
        //         typeTraits.push(prop);
        //         break;
        //       }
        //     }
        //   }
        //   return typeTraits;
        // }
    // _loadOptions(options, filterRestrictions = true, useTemplateBaseDirectory = true, saveUserSel = true){

    //     // XXX I think this part was used to know which trait was selected
    //     // for (const option of options) {
    //     //   updateCurrentTraitMap(option.trait.trait, option.key)
    //     // }
    
    //     if (filterRestrictions)
    //       options = _filterRestrictedOptions(options);
    
    //     //save selection to local storage
    //     // if (saveUserSel)
    //     //   saveUserSelection(options)
    
    //     // validate if there is at least a non null option
    //     let nullOptions = true;
    //     options.map((option)=>{
    //       if(option.item != null)
    //         nullOptions = false;
    //     })
    //     if (nullOptions === true){
    //       return new Promise((resolve) => {
    //         resolve(options)
    //       });
    //     }
    
    //     setIsLoading(true);
    
    //     //create the manager for all the options
    //     const loadingManager = new THREE.LoadingManager()
    
    //     //create a gltf loader for the 3d models
    //     const gltfLoader = new GLTFLoader(loadingManager)
    //     gltfLoader.crossOrigin = 'anonymous';
    
    //     gltfLoader.register((parser) => {
    //       //return new VRMLoaderPlugin(parser, {autoUpdateHumanBones: true, helperRoot:vrmHelperRoot})
    
    //       // const springBoneLoader = new VRMSpringBoneLoaderPlugin(parser);
    //       // return new VRMLoaderPlugin(parser, {autoUpdateHumanBones: true, springBonePlugin:springBoneLoader})
    
    //       return new VRMLoaderPlugin(parser, {autoUpdateHumanBones: true})
    //     })
    
    //     // and a texture loaders for all the textures
    //     const textureLoader = new THREE.TextureLoader(loadingManager)
    //     loadingManager.onProgress = function(url, loaded, total){
    //       setLoadPercentage(Math.round(loaded/total * 100 ))
    //     }
    //     // return a promise, resolve = once everything is loaded
    //     return new Promise((resolve) => {
    
    //       // resultData will hold all the results in the array that was given this function
    //       const resultData = [];
    //       loadingManager.onLoad = function (){
    //         setLoadPercentage(0)
    //         resolve(resultData);
    //         setIsLoading(false)
    //       };
    //       loadingManager.onError = function (url){
    //         console.log("currentTraits", resultData);
    //         console.warn("error loading " + url)
    //       }
    //       loadingManager.onProgress = function(url, loaded, total){
    //         setLoadPercentage(Math.round(loaded/total * 100 ))
    //       }
          
          
    //       const baseDir = useTemplateBaseDirectory ? (templateInfo.assetsLocation || "") + templateInfo.traitsDirectory : "";
    //       // load necesary assets for the options
    //       options.map((option, index)=>{
    //         if (option.selected){
    //           setSelectValue(option.key)
    //         }
    //         if (option == null){
    //           resultData[index] = null;
    //           return;
    //         }
    //         // load model trait
    //         const loadedModels = [];
    //         const models = getAsArray(option?.item?.directory);
    //         try {
    //           models.forEach(async (modelDir, i) => {
    //             try {
    //               const mod = await gltfLoader.loadAsync(baseDir + modelDir);
    //               loadedModels[i] = mod;
    //             } catch (error) {
    //               console.error(`Error loading model ${modelDir}:`, error);
    //               options.splice(index, 1);
    //               resultData.splice(index, 1);
    //             }
    //           });
    //         } catch (error) {
    //           console.error('An error occurred:', error);
    //           //remove option
    //         }
            
    //         // load texture trait
    //         const loadedTextures = [];
    //         getAsArray(option?.textureTrait?.directory).map((textureDir, i)=>{
    //           textureLoader.load(baseDir + textureDir,(txt)=>{
    //             txt.flipY = false;
    //             loadedTextures[i] = (txt)
    //           })
    //         })
    
    //         // and just create colors
    //         const loadedColors = [];
    //         getAsArray(option?.colorTrait?.value).map((colorValue, i)=>{
    //           loadedColors[i] = new THREE.Color(colorValue);
    //         })
    //         resultData[index] = {
    //           item:option?.item,
    //           trait:option?.trait,
    //           textureTrait:option?.textureTrait,
    //           colorTrait:option?.colorTrait,
    //           models:loadedModels,          
    //           textures:loadedTextures, 
    //           colors:loadedColors      
    //         }
    //       })
    //     });
    // }
export default [
  {
    "id": "1",
    "name": "Neurohacker Female",
    "file": "./3d/models/drophunter.vrm",
    "thumbnail": "./3d/icons/female-body-1.png",
    "format": "vrm",
    "offset":[0,-0.18,0],
    "bodyTargets": [
      "Body",
      "Headbaked"
    ],
    "cullingModel":[
      "body_geo"
    ],
    "EyeTargets": [
        "Headbaked_2",
        "Headbaked_1",
    ],
    "traitsDirectory": "https://webaverse-studios.github.io/character-assets/drophunter/",
    "thumbnailsDirectory": "https://webaverse-studios.github.io/character-assets/drophunter/",
    "traitsJsonPath": "https://webaverse-studios.github.io/character-assets/drophunter/loot.json",
    "animationPath": "./3d/animations/idle_drophunter.fbx",
    "traitIconsDirectory": "./3d/icons/",
    "typeRestrictions":{
        "pants" : ["boots"]
    },
    "selectionTraits": [
      {
        "name": "skin",
        "icon": "skin-color.png",
        "type": "texture",
        "target": ["body_geo", "head_geobaked(copy)_1"],
        "icon-gradient": "color-gradient.svg",
        "cameraTarget":{
          "distance": 3.4,
          "height": 0.8
        }
      },
    {
      "name": "eyes",
      "icon": "eye.png",
      "type": "texture",
      "target": "head_geobaked(copy)",
      "icon-gradient": "eye.svg",
      "cameraTarget":{
        "distance": 0.75,
        "height": 1.35
      }
    },
    {
      "name": "head",
      "icon": "hairStyle.png",
      "type": "mesh",
      "icon-gradient": "hairStyle.svg",
      "cameraTarget":{
        "distance": 0.75,
        "height": 1.35
      }
    },
    {
      "name": "outer",
      "restrictedTypes": ["hoodie", "solo"],
      "icon": "jacket.png",
      "icon-gradient": "jacket.svg",
      "type": "mesh",
      "cameraTarget":{
        "distance": 1.5,
        "height": 1
      }
    },
    {
      "name": "chest",
      "icon": "torso.png",
      "icon-gradient": "chest-gradient.svg",
      "type": "mesh",
      "cameraTarget":{
        "distance": 1.5,
        "height": 1
      }
    },
    {
      "name": "accessories",
      "icon": "accessories.png",
      "type": "mesh",
      "id":3,
      "icon-gradient": "accessories-gradient.svg",
      "cameraTarget":{
        "distance": 3.4,
        "height": 0.8
      }
    },
    {
      "name": "legs",
      "icon": "legs.png",
      "type": "mesh",
      "icon-gradient": "chest-gradient.svg",
      "id":4,
      "cameraTarget":{
        "distance": 2,
        "height": 0.5
      }
    },
    {
      "name": "feet",
      "icon": "shoes.png",
      "type": "mesh",
      "icon-gradient": "foot-gradient.svg",
      "id":5,
      "cameraTarget":{
          "distance": 1.3,
          "height": 0.2
      }
    }
  ]
  }
  ,
  {
    "id": "2",
    "name": "Neurohacker Male",
    "file": "./3d/models/neurohacker.vrm",
    "thumbnail": "./3d/icons/male-body-1.png",
    "format": "vrm",
    "offset":[0,-0.14,0],
    "bodyTargets": [
      "Body",
      "Head002"
    ],
    "cullingModel":[
      "Body"
    ],
    "EyeTargets": [
      "Head006"
    ],
    "traitsDirectory": "https://webaverse-studios.github.io/character-assets/neurohacker/",
    "thumbnailsDirectory": "https://webaverse-studios.github.io/character-assets/neurohacker/",
    "traitsJsonPath": "https://webaverse-studios.github.io/character-assets/neurohacker/loot.json",
    "animationPath": "./3d/animations/idle_neurohacker.fbx",
    "traitIconsDirectory": "./3d/icons/",
    "selectionTraits": [
    {
      "name": "skin",
      "icon": "skin-color.png",
      "type": "texture",
      "target": ["Body", "Headbaked(copy)"],
      "icon-gradient": "color-gradient.svg",
      "cameraTarget":{
        "distance": 3.4,
        "height": 0.8
      }
    },
    {
      "name": "eyes",
      "icon": "eye.png",
      "type": "texture",
      "target": "Headbaked(copy)_1",
      "icon-gradient": "eye.svg",
      "cameraTarget":{
        "distance": 1.2,
        "height": 1.35
      }
    },{
      "name": "head",
      "icon": "hairStyle.png",
      "type": "mesh",
      "icon-gradient": "head-gradient.svg",
      "cameraTarget":{
        "distance": 1.2,
        "height": 1.35
      }
    },
    {
      "name": "outer",
      "restrictedTypes": ["hoodie", "solo"],
      "icon": "jacket.png",
      "icon-gradient": "jacket.svg",
      "type": "mesh",
      "cameraTarget":{
        "distance": 1.5,
        "height": 1
      }
    },{
      "name": "chest",
      "icon": "torso.png",
      "icon-gradient": "chest-gradient.svg",
      "type": "mesh",
      "cameraTarget":{
        "distance": 1.5,
        "height": 1
      }
    },{
      "name": "accessories",
      "icon": "accessories.png",
      "type": "mesh",
      "id":3,
      "icon-gradient": "accessories-gradient.svg",
      "cameraTarget":{
        "distance": 3.4,
        "height": 0.8
      }
    },{
      "name": "legs",
      "icon": "legs.png",
      "type": "mesh",
      "icon-gradient": "chest-gradient.svg",
      "id":4,
      "cameraTarget":{
        "distance": 2,
        "height": 0.5
      }
    },{
      "name": "feet",
      "icon": "shoes.png",
      "type": "mesh",
      "icon-gradient": "foot-gradient.svg",
      "id":5,
      "cameraTarget":{
        "distance": 1.3,
        "height": 0.2
      },
    }]
  } 
  ,
  {
    "id": "3",
    "name": "Female",
    "file": "./3d/models/f_neurohacker_v1.vrm",
    "thumbnail": "./3d/icons/female-body-1.png",
    "format": "vgitrm",
    "bodyTargets": [
        "Body_Female",
        "Head_femalebaked"
    ],
    "EyeTargets": [
        "Head_femalebaked_3"
    ],
    "traitsDirectory": "https://webaverse-studios.github.io/character-assets/neurohacker/female/",
    "thumbnailsDirectory": "https://webaverse-studios.github.io/character-assets/neurohacker/female/",
    "traitsJsonPath": "https://webaverse-studios.github.io/character-assets/neurohacker/female/loot.json",
    "animationPath": "./3d/animations/idle_sword.fbx",
    "traitIconsDirectory": "./3d/icons/",
    "selectionTraits": [{
      "name": "color",
      "id":1,
      "icon": "skin-color.png",
      "type": "color",
      "icon-gradient": "color-gradient.svg",
      "buttonName": "Skin Color",
      "cameraTarget":{
        "distance": 1.5,
        "height": 0.9
      },
      "subTrait":[
      {
        "name": "Eye Color",
        "type": "color",
        "cameraTarget":{
          "distance": 0.5,
          "height": 1.55
        },
        "bodyTargets": [
          "Eye"
        ]
      }]
    },{
      "name": "head",
      "icon": "hairStyle.png",
      "type": "mesh",
      "id":2,
      "icon-gradient": "head-gradient.svg",
      "cameraTarget":{
        "distance": 0.5,
        "height": 1.55
      }
    },{
      "name": "chest",
      "icon": "torso.png",
      "icon-gradient": "chest-gradient.svg",
      "type": "mesh",
      "cameraTarget":{
        "distance": 1.4,
        "height": 0.9
      }
    },{
      "name": "accessories",
      "icon": "accessories.png",
      "type": "mesh",
      "id":3,
      "icon-gradient": "accessories-gradient.svg",
      "cameraTarget":{
        "distance": 1.7,
        "height": 0.8
      }
    },{
      "name": "legs",
      "icon": "legs.png",
      "type": "mesh",
      "icon-gradient": "chest-gradient.svg",
      "id":4,
      "cameraTarget":{
        "distance": 1.5,
        "height": 0.6
      }
    },{
      "name": "feet",
      "icon": "shoes.png",
      "type": "mesh",
      "icon-gradient": "foot-gradient.svg",
      "id":5,
      "cameraTarget":{
        "distance": 0.8,
        "height": 0.32
      },
      "eye": {
        "distance": 0.3,
        "height": 1.5
      }
    }]
    },
    {
    "id": "4",
    "name": "Male",
    "file": "./3d/models/m_neurohacker_v1.vrm",
    "thumbnail": "./3d/icons/male-body-1.png",
    "format": "vrm",
    "bodyTargets": [
        "Body",
        "Face_Malebaked"
    ],
    "EyeTargets": [
        "Face_Malebaked_2"
    ],
    "traitsDirectory": "https://webaverse-studios.github.io/character-assets/neurohacker/male/",
    "thumbnailsDirectory": "https://webaverse-studios.github.io/character-assets/neurohacker/male/",
    "traitsJsonPath": "https://webaverse-studios.github.io/character-assets/neurohacker/male/loot.json",
    "animationPath": "./3d/animations/idle_sword.fbx",
    "traitIconsDirectory": "./3d/icons/",
    "selectionTraits": [{
      "name": "color",
      "id":1,
      "icon": "skin-color.png",
      "type": "color",
      "icon-gradient": "color-gradient.svg",
      "buttonName": "Skin Color",
      "cameraTarget":{
        "distance": 1.4,
        "height": 0.8
      },
      "subTrait":[
      {
        "name": "Eye Color",
        "type": "color",
        "cameraTarget":{
          "distance": 0.5,
          "height": 1.45
        },
        "bodyTargets": [
          "Eye"
        ]
      }]
    },{
      "name": "head",
      "icon": "hairStyle.png",
      "type": "mesh",
      "id":2,
      "icon-gradient": "head-gradient.svg",
      "cameraTarget":{
        "distance": 0.5,
        "height": 1.45
      }
    },{
      "name": "chest",
      "icon": "torso.png",
      "icon-gradient": "chest-gradient.svg",
      "type": "mesh",
      "cameraTarget":{
        "distance": 1.3,
        "height": 0.9
      }
    },{
      "name": "accessories",
      "icon": "accessories.png",
      "type": "mesh",
      "id":3,
      "icon-gradient": "accessories-gradient.svg",
      "cameraTarget":{
        "distance": 1.4,
        "height": 0.8
      }
    },{
      "name": "legs",
      "icon": "legs.png",
      "type": "mesh",
      "icon-gradient": "chest-gradient.svg",
      "id":4,
      "cameraTarget":{
        "distance": 1.1,
        "height": 0.55
      }
    },{
      "name": "feet",
      "icon": "shoes.png",
      "type": "mesh",
      "icon-gradient": "foot-gradient.svg",
      "id":5,
      "cameraTarget":{
        "distance": 0.8,
        "height": 0.32
      },
      "eye": {
        "distance": 0.3,
        "height": 1.5
      }
    }]
  }  
]
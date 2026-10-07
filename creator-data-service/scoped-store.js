'use strict';

const {createHash}=require('node:crypto');
const {createCreatorStore:createBaseStore}=require('./store');

function storageKey(kind,briefId,logicalId){
  const digest=createHash('sha256').update(JSON.stringify([String(kind),String(briefId),String(logicalId)])).digest('hex').slice(0,32);
  return `${kind}_${digest}`;
}

function stripInternal(value){
  const copy={...value};
  delete copy.__logicalId;
  delete copy.__logicalSupportingSourceIds;
  return copy;
}

function toStorageBundle(input={}){
  const brief=input.brief||input;
  const briefId=String(brief?.id||'');
  const sources=(Array.isArray(input.sources||brief?.sources)?(input.sources||brief.sources):[]).map(source=>({
    ...source,
    __logicalId:String(source.id),
    id:storageKey('src',briefId,source.id),
  }));
  const claims=(Array.isArray(input.claims||brief?.claims)?(input.claims||brief.claims):[]).map(claim=>({
    ...claim,
    __logicalId:String(claim.id),
    __logicalSupportingSourceIds:Array.isArray(claim.supportingSourceIds)?claim.supportingSourceIds.map(String):[],
    id:storageKey('clm',briefId,claim.id),
    supportingSourceIds:(Array.isArray(claim.supportingSourceIds)?claim.supportingSourceIds:[]).map(id=>storageKey('src',briefId,id)),
  }));
  return{brief,sources,claims};
}

function fromStorageBundle(bundle){
  if(!bundle)return null;
  const sources=(bundle.sources||[]).map(source=>stripInternal({...source,id:String(source.__logicalId||source.id)}));
  const claims=(bundle.claims||[]).map(claim=>stripInternal({
    ...claim,
    id:String(claim.__logicalId||claim.id),
    supportingSourceIds:Array.isArray(claim.__logicalSupportingSourceIds)?claim.__logicalSupportingSourceIds:claim.supportingSourceIds,
  }));
  return{...bundle,sources,claims};
}

function createCreatorStore(options={}){
  const base=createBaseStore(options);
  return{
    dbPath:base.dbPath,
    health:base.health,
    close:base.close,
    listBriefs:base.listBriefs,
    latestReceipt:base.latestReceipt,
    saveBundle(input){
      const saved=base.saveBundle(toStorageBundle(input));
      const logical=fromStorageBundle(saved);
      return{...logical,receipt:saved.receipt};
    },
    getBundle(id){return fromStorageBundle(base.getBundle(id));},
  };
}

module.exports={createCreatorStore,storageKey,toStorageBundle,fromStorageBundle};

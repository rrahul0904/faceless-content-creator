'use strict';
const {registryVersion,verifiedAt,sources,searchTechnicalIcons}=require('../lib/technical-icons');
module.exports=async function(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const q=Array.isArray(req.query?.q)?req.query.q[0]:req.query?.q;
  const provider=Array.isArray(req.query?.provider)?req.query.provider[0]:req.query?.provider;
  const data=searchTechnicalIcons(String(q||'').slice(0,160),String(provider||'').slice(0,40)).slice(0,100);
  return res.status(200).json({ok:true,registry:{version:registryVersion,verifiedAt,sources},data});
};

'use strict';
const { planVisualStory } = require('../lib/visual-story');

module.exports = async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const story=planVisualStory(body);
    return res.status(200).json({story});
  }catch(error){
    const status=Number(error&&error.status)||500;
    return res.status(status).json({error:error&&error.message||'VISUAL_STORY_FAILED'});
  }
};

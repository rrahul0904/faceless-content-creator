'use strict';
const research=require('../data/product-research.json');
module.exports=async function(req,res){res.setHeader('Cache-Control','no-store');return res.status(200).json({ok:true,...research});};

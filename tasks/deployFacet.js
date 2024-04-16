//note : this task is used for deploying a specific facet 
//Run  : npx hardhat deployFacet --facet  <facet_name> --network <network_name>
const { config } = require('dotenv');
config()
const { task }=require("hardhat/config");

task("deployFacet","This task is for deploying a specific facet.")
.addParam("facet","enter facet name to deploy")
.setAction(async (args)=>{
    const FacetName =  args.facet
    try{
        const Facet = await ethers.getContractFactory(FacetName);
        const facet = await Facet.deploy();
        await facet.deployed();
        console.log(`${FacetName} deployed: ${facet.address}`);
    }
    catch(e){
        console.log("error deploying facet: ", e);
    }
})

module.exports={}
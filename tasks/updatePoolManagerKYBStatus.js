//note : this task is used for updating pool manager KYB status 
//     -if pool manager is already verified then it will print "Pool manager already verified"
//     -otherwise it will update pool manager status to VERIFIED and print "successfully updated pool manager KYB staus"

//Run  :    npx hardhat updatePoolManagerKYBStatus --poolmanagerid  <poolmanager_Id> --network goerli
const { config } = require('dotenv');
config()
const { task }=require("hardhat/config");

task("updatePoolManagerKYBStatus","This task is for updating poolManager KYB status.")
.addParam("poolmanagerid","enter pool manager Id for which we want to update KYB status")
.setAction(async (args)=>{

    const poolManagerId =  args.poolmanagerid
    const KYBStatus= ["PENDING", "VERIFIED", "REJECTED"]

    try{
        const poolManagerFacet = await ethers.getContractAt("PoolManagerFacet", process.env.DIAMOND_ADDRESS);
        const poolManagerUserId = await poolManagerFacet.getPoolManagerUserId(poolManagerId)
        if(poolManagerUserId.length > 0)
        {
            const poolManagerData =await poolManagerFacet.getPoolManagerKYBStatus(poolManagerId);
            console.log(`Current pool manager KYB Status : `, KYBStatus[poolManagerData]);
            if(KYBStatus[poolManagerData]=="VERIFIED"){
                console.log("Pool manager KYB status is already verified.");
            }
            else{
                try{
                    await poolManagerFacet.updatePoolManagerKYB(poolManagerId, 1)
                    console.log("Successfully updated Pool manager KYB status.");
                }
                catch(e)
                {
                    console.log("Updating Pool manager KYB status error : ", e);
                }
            }
        }
        else{
            console.log("Pool manager not exist.")
        }
       
    }
    catch(e){
        console.log("Update Pool manager KYB status error : ", e);
    }
})

module.exports={}
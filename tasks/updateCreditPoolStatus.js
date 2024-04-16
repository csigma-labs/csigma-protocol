//note : this task is used for updating credit pool status 
//     -if credit pool is already active then it will print "Credit pool is already verified"
//     -otherwise it will update credit pool status to ACTIVE and print "successfully updated credit pool staus"

//Run  :    npx hardhat updateCreditPoolStatus --poolid  <pool_Id> --network goerli
const { config } = require('dotenv');
config()
const { task }=require("hardhat/config");

task("updateCreditPoolStatus","This task is for updating credit pool status.")
.addParam("poolid","enter credit pool Id for which we want to update status")
.setAction(async (args)=>{

    const poolId =  args.poolid
    const Status= ["PENDING", "ACTIVE", "INACTIVE"]

    try{
        const creditPoolFacet = await ethers.getContractAt("CreditPoolFacet", process.env.DIAMOND_ADDRESS);
        const poolManagerId = await creditPoolFacet.getCreditPoolManagerId(poolId)
        if(poolManagerId.length > 0)
        {
            const poolData =await creditPoolFacet.getCreditPoolStatus(poolId);
            console.log(`Current credit pool status : `, Status[poolData]);
            if(Status[poolData]=="ACTIVE"){
                console.log("Credit pool status is already active.");
            }
            else{
                try{
                    await creditPoolFacet.updateCreditPoolStatus(poolId, 1)
                    console.log("Successfully updated credit pool status.");
                }
                catch(e)
                {
                    console.log("Updating credit pool status error : ", e);
                }
            }
        }
        else{
            console.log("Credit pool not exist.")
        }
       
    }
    catch(e){
        console.log("Update credit pool status error : ", e);
    }
})

module.exports={}
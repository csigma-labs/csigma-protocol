//note : this task is used for updating lender KYB status 
//     -if lender is alredy verified then it will print "Lender already verified"
//     -otherwise it will update lender status to VERIFIED and print "successfully updated lender KYB staus"

//Run  :    npx hardhat updateLenderKYBStatus --lenderid  <lender_Id> --network goerli
const { config } = require('dotenv');
config()
const { task }=require("hardhat/config");

task("updateLenderKYBStatus","This task is for updating lender KYB status.")
.addParam("lenderid","enter lender Id for which we want to update KYB status")
.setAction(async (args)=>{

    const lenderId =  args.lenderid
    const KYBStatus= ["PENDING", "VERIFIED", "REJECTED"]

    try{
        const lenderFacet = await ethers.getContractAt("LenderFacet", process.env.DIAMOND_ADDRESS);
        const lenderUserId = await lenderFacet.getLenderUserId(lenderId)
        if(lenderUserId.length > 0)
        {
            const lenderData =await lenderFacet.getLenderKYBStatus(lenderId);
            console.log(`Current lender KYB Status : `, KYBStatus[lenderData]);
            if(KYBStatus[lenderData]=="VERIFIED"){
                console.log("Lender KYB status is already verified.");
            }
            else{
                try{
                    await lenderFacet.updateLenderKYB(lenderId, 1)
                    console.log("Successfully updated Lender KYB status.");
                }
                catch(e)
                {
                    console.log("Updating Lender KYB status error : ", e);
                }
            }
        }
        else{
            console.log("Lender not exist.")
        }
       
    }
    catch(e){
        console.log("Update lender KYB status error : ", e);
    }
})

module.exports={}
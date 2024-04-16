// note : this script is for creating credit pool from file 'creditPoolData.csv'
//      -if credit pool already exist it return message "Credit Pool already exist with pool id : <CreditPoolId>"
//      -if pool manager is not KYB verified it return message "Pool manager is not KYB verified : <PoolManagerId>"
//      -otherwise it will create Creditpool and print message "successfully created credit pool with id : <creditpoolId> "

// Run : npx hardhat run scripts/createPoolManager.js --network goerli

const readCSVData = require('./readCSV')
const writeCSVData = require('./writeCSV')
const { config } = require('dotenv');
config()

async function createCreditPool() {
    let creditPoolData 
    try{
        try{
            const filename = 'creditPoolData.csv'
            creditPoolData = await readCSVData(filename)
        }
        catch(e){
            console.log("Read csv data error :", e);
        }

        const CreditPoolFacet = await ethers.getContractAt("CreditPoolFacet", process.env.DIAMOND_ADDRESS);
        const poolManagerFacet = await ethers.getContractAt("PoolManagerFacet", process.env.DIAMOND_ADDRESS);
            
        for( i = 0 ; i < creditPoolData.length ; i++)
        {
            let creditPoolManagerId = await CreditPoolFacet.getCreditPoolManagerId(creditPoolData[i]._creditPoolId)
            if(creditPoolManagerId ==='' || creditPoolManagerId ===undefined)
            {
                if((await poolManagerFacet.getPoolManagerKYBStatus(creditPoolData[i]._poolManagerId))===1)
                {
                try{
                    await CreditPoolFacet.createCreditPool(
                        creditPoolData[i]._creditPoolId,
                        creditPoolData[i]._poolManagerId,
                        creditPoolData[i]._metaHash,
                        creditPoolData[i]._borrowingAmount,
                        creditPoolData[i]._inceptionTime,
                        creditPoolData[i]._expiryTime,
                        creditPoolData[i]._curingPeriod,
                        creditPoolData[i]._status
                    )
                    console.log("successfully created credit pool with id : ", creditPoolData[i]._creditPoolId);
                    creditPoolData[i].result="successfully created"
                }
                catch(e){
                    console.log("creating credit pool failed :", e);
                    creditPoolData[i].result="Credit pool creation failed"
                }
            }
            else{
                console.log(`Pool manager ${creditPoolData[i]._poolManagerId} is not KYB verified.`);
                creditPoolData[i].result="pool manager not KYB verified"
            }
            }
            else{
                console.log("credit pool already exist with poolId : ", creditPoolData[i]._creditPoolId);
                creditPoolData[i].result="credit pool already exist"
            }
        }
    }
    catch(e){
        console.log("Error in function createCreditPool :", e);
    }
    writeCSVData("creditPoolData.csv",creditPoolData)
}
createCreditPool()
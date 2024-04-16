// note : this script is for creating pool manager from file 'poolManagerData.csv'
//      -if manager already exist it return message "Pool manager already exist with id : <poolManagerId>"
//      -otherwise it will create poolmanagerand print message "Pool manager created successfully with id : <poolManagerId> "

// Run : npx hardhat run scripts/createPoolManager.js --network goerli

const readCSVData = require('./readCSV')
const writeCSVData = require('./writeCSV')
const { config } = require('dotenv');
config()

async function createPoolManager(){
    let poolManagerData
    try{
        try{
            const filename= "poolManagerData.csv"
            poolManagerData = await readCSVData(filename)
        }
        catch(e){
            console.log("Read CSV file failed :", e);
        }
        const poolManagerFacet = await ethers.getContractAt("PoolManagerFacet", process.env.DIAMOND_ADDRESS);
        for(i = 0 ; i < poolManagerData.length ; i++) {
        
            let poolManagerUserId = await poolManagerFacet.getPoolManagerUserId(poolManagerData[i]._poolManagerId)
            console.log(poolManagerUserId);
            if(poolManagerUserId ==='' || poolManagerUserId ===undefined)
            {
                try{
                    await poolManagerFacet.createPoolManager(
                        poolManagerData[i]._poolManagerId,
                        poolManagerData[i]._userId,
                        poolManagerData[i]._metaHash,
                        poolManagerData[i]._country,
                        Math.floor(new Date(poolManagerData[i]._onBoardTime).getTime() / 1000),
                        poolManagerData[i]._wallet,
                        poolManagerData[i]._status
                    )
                    console.log("Pool manager created successfully with id :", poolManagerData[i]._poolManagerId);
                    poolManagerData[i].result = "successfully created";
                }
                catch(e){
                    console.log("pool manager creation error :", e);
                    poolManagerData[i].result = "pool manager creation error";
                }
            }
            else{
                console.log("Pool manager already exist with id :", poolManagerData[i]._poolManagerId);
                poolManagerData[i].result = "pool manager already exist";
            }
        } 
    }
    catch(e){
        console.log("error in function createPoolManager : ", e);
    }
    writeCSVData("poolManagerData.csv", poolManagerData);
}
createPoolManager()
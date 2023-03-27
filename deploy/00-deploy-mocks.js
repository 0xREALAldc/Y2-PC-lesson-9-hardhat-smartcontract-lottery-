const { developmentChains } = require("../helper-hardhat-config")

// BASE FEE is the same as the 'Premium' in chainlink VRF docs
const BASE_FEE = ethers.utils.parseEther("0.25") //0.25 is the premium. It costs 0.25 LINK per request

//GAS PRICE LINK is a calculated value based on the gas price of the chain
// Chainlink nodes pay the fees to give us randomness & do external execution
// so the price of requests change based on the price of gas
const GAS_PRICE_LINK = 1e9//1000000000 //link per gas

// we deconstruct the getNamedAccounts and deployments from HRE
module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const args = [BASE_FEE, GAS_PRICE_LINK]

  if (developmentChains.includes(network.name)) {
    log("Local network detected! Deploying mocks...")
    
    //deploy a mock of vrfCoordinator 
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: args,
    })

    log("Mocks Deployed!!")
    log("-------------------------------------------------------------")
  }
}

module.exports.tags = ["all", "mocks"]
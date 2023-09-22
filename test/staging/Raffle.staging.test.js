// To be able to run our Staging test on a real testnet, we need the following below:
/* 1. Get our SubscriptionId for Chainlink VRF and fund with link
*  2. Deploy our contract using the SubscriptionId
*  3. Register the contract with Chainlink VRF and it's subscription ID
*  4. Register the contract with the Chainlink Automation
*  5. Run staging tests
*/


const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)  
  ? describe.skip  
  : describe("Raffle Unit Test", function() {
    let raffle, raffleEntranceFee, deployer

    beforeEach(async function() {
      deployer = (await getNamedAccounts()).deployer
      raffle = await ethers.getContract("Raffle", deployer)
      raffleEntranceFee = await raffle.getEntranceFee()
    })

    describe("fullfilRandomWords", function() {
      it("works with live Chainlink Automation and Chainlink VRF, we get a random winner", async function() {
        //we need to enter the raffle 
        const startingTimeStamp = await raffle.getLatestTimeStamp()
        const accounts = await ethers.getSigners()

        //we need to set up the listener BEFORE we enter the raffle
        await new Promise(async (resolve, reject) => {

          // listener is ON
          raffle.once("WinnerPicked", async () => { 
            console.log("WinnerPicked event fired!")
            
            try {
              // add our asserts here 
              const recentWinner = await raffle.getRecentWinner()
              const raffleState = await raffle.getRaffleState()
              const winnerEndingBalance = await accounts[0].getBalance()
              const endingTimeStamp = await raffle.getLatestTimeStamp()
              console.log("we got all the variables")

              // check if the players array was reseted 
              // we can test by the players array lenght too, but 
              // this way below the transaction should be reverted
              // when we try to access the position `0` that don't exists
              await expect(raffle.getPlayer(0)).to.be.reverted 
              console.log("transaction getPlayer reverted")

              // check if the winner was our deployer (account[0])
              // this because we only entered with him
              assert.equal(recentWinner.toString(), accounts[0].address)
              console.log("assert of recent winner is true")

              // check if the raffleState was set to OPEN = 0
              assert.equal(raffleState, 0)
              console.log("raffleState is OPEN")

              // check if the money was correctly sent to the winner
              // for this we would need to add the costs from the gas in the transaction to enter the raffle too, to 
              // be able to measure this correctly
              assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(raffleEntranceFee).toString())

              // check to see if the raffle did passed the time
              assert(endingTimeStamp > startingTimeStamp)
              console.log("ending time stamp greater than starting time stamp")

              console.log("resolve")
              resolve()
              console.log("resolved")
            } catch(error) {
              console.log(error)
              reject(error)
            }
          })

          //here we enter the raffle after we have our listenet set up 
          const tx = await raffle.enterRaffle({ value: raffleEntranceFee})
          await tx.wait(1)
          const winnerStartingBalance = await accounts[0].getBalance()
        })
      })
    })
  })
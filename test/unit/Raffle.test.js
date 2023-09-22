const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name) ? 
  describe.skip : 
  describe("Raffle Unit Test", function() {
    // we need the Raffle and vrlCoordinatorV2Mock contracts deployed
    let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
    const chainId = network.config.chainId

    beforeEach(async function() {
      deployer = (await getNamedAccounts()).deployer
      await deployments.fixture(["all"]) //we run our 00 and 01 deploy scripts  
      raffle = await ethers.getContract("Raffle", deployer)
      vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
      raffleEntranceFee = await raffle.getEntranceFee()
      interval = await raffle.getInterval()
    })

    describe("constructor", function() {
      it("Initializes the raffle correctly", async function() {
        // Ideally we make our tests have just 1 assert per "it", we're going to have more here only today
        const raffleState = await raffle.getRaffleState()

        assert.equal(raffleState.toString(), "0")
        assert.equal(interval.toString(), networkConfig[chainId]["interval"])
      })
    })
    
    describe("enterRaffle", function() {
      it("reverts when you don't pay enough", async function() {
        await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEntered")
      })

      it("doesnt allow entrance when raffle is calculating", async function(){
        // we make the changes needed to fulfill the "checkUpkeep" and return true in it
        await raffle.enterRaffle({ value: raffleEntranceFee }) // we set one user in the raffle
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // we increase the time in the blockchain to pass our interval
        await network.provider.send("evm_mine", []) // we mine an extra block

        //then we will call the "performUpkeep" pretending to the a Chainlink Automation calling and the "checkUpkeep" will return true 
        //because of the changes we did in the lines above
        await raffle.performUpkeep([])

        //now that after we call the "performUpkeep" the raffle will be in the state "CALCULATING" and we can test and see that
        //if we try to enter the raffle, it will revert with the error "Raffle__NotOpen"
        await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith("Raffle__NotOpen")
      })

      it("records players when they enter", async function() {
        await raffle.enterRaffle({ value: raffleEntranceFee })
        const playerWhoJustEnteredTheRaffle = await raffle.getPlayer(0)
        assert.equal(playerWhoJustEnteredTheRaffle, deployer)
      })

      it("emits event on enter", async function() {
        await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEnter")
      })
    })

    describe("checkUpkeep", function() {
      it("returns false if people haven't sent any ETH", async function() {
        await network.provider.send("evm_increaseTime", [ interval.toNumber() + 1 ])
        await network.provider.send("evm_mine", [])
        const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])

        assert(!upkeepNeeded)
      })

      it("returns false if raffle isn't open", async function() {
        await raffle.enterRaffle({ value: raffleEntranceFee })
        await network.provider.send("evm_increaseTime", [ interval.toNumber() + 1 ])
        await network.provider.send("evm_mine", [])
        await raffle.performUpkeep([])

        const raffleState = await raffle.getRaffleState()
        const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")

        assert.equal(raffleState.toString(), "1")
        assert.equal(upkeepNeeded, false)
      })

      it("returns false if enough time hasn't passed", async () => { 
        await raffle.enterRaffle({ value: raffleEntranceFee })
        await network.provider.send("evm_increaseTime", [ interval.toNumber() - 2 ])
        await network.provider.request({ method: "evm_mine", params: [] }) //another way to call a method from the provider is with '.request'

        const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
        // assert.equal(!upkeepNeeded, false)
        assert(!upkeepNeeded)
      })

      it("returns true if enough time has passed, has players, has eth and is open", async () => {
        await raffle.enterRaffle({ value: raffleEntranceFee })
        await network.provider.send("evm_increaseTime", [ interval.toNumber() + 1 ])
        await network.provider.request({ method: "evm_mine", params: [] })

        const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
        assert(upkeepNeeded)
      })
    })

    describe("performUpkeep", function () {
      it("it can only run if checkUpkeep is true", async function() {
        await raffle.enterRaffle({ value: raffleEntranceFee })
        await network.provider.send("evm_increaseTime", [ interval.toNumber() + 2 ])
        await network.provider.send("evm_mine", [] )

        const tx = await raffle.performUpkeep("0x") // this will return a transaction and in the assert(tx) will be true if not reverted
        assert(tx)
      })

      it("reverts when checkUpkeep is false", async function() {
        await expect(raffle.performUpkeep("0x")).to.be.revertedWith("Raffle__UpkeepNotNeeded")
      })

      it("updates the raffle state, emits an event and calls the vrfCoordinator", async function() {
        await raffle.enterRaffle({ value: raffleEntranceFee })
        await network.provider.send("evm_increaseTime", [ interval.toNumber() + 2 ])
        await network.provider.send("evm_mine", [] )

        // we will get the event from the position '1' because in the position '0' we already have an event that was emitted by the 'i_vrfCoordinator.requestRandomWords' in the
        // 'performUpkeep' method
        const txResponse = await raffle.performUpkeep("0x")
        const txReceipt = await txResponse.wait(1)
        const requestId = txReceipt.events[1].args.requestId
        const raffleState = await raffle.getRaffleState()

        assert(requestId.toNumber() > 0)
        assert(raffleState.toString() == "1")
      })
    })

    describe("fullfilRandomWords", function() {
      beforeEach(async function() {
        await raffle.enterRaffle({ value: raffleEntranceFee })
        await network.provider.send("evm_increaseTime", [ interval.toNumber() + 2 ])
        await network.provider.send("evm_mine", [])
      })

      it("can only be called after performUpkeep", async function() {
        await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request")
        await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request")
      })

      it("picks a winner, resets the lottery and sends money", async function() {
        const additionalEntrants = 3
        const startingAccountIndex = 1 // deployer = 0
        const accounts = await ethers.getSigners() // here we'll get the other accounts to use in the for..loop

        for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants;  i++) {
          const accountConnectedRaffle = raffle.connect(accounts[i])
          await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee})
        }

        const startingTimeStamp = await raffle.getLatestTimeStamp()

        // now we're going to
        // call the 'performUpkeep' (mock being the chainlink automation)
        // call the 'fulfillRandomWords' (mock being the chainlink VRF)
        // we will have to wait for the 'fulfillRandomWords' to be called
        
        // we're going to use a promise to wait for the method to be called and resolved
        await new Promise(async (resolve, reject) => {
          // we're going to set up our listener first because we need him ready when we call the fulfillRandomWords
          raffle.once("WinnerPicked", async () => {
            // console.log("Found the event!")
            try {
              const recentWinner = await raffle.getRecentWinner()
              const raffleState = await raffle.getRaffleState()
              const endingTimeStamp = await raffle.getLatestTimeStamp();
              const numberOfPlayers = await raffle.getNumberOfPlayers()
              const winnerEndingBalance = await accounts[1].getBalance()

              assert.equal(numberOfPlayers.toString(), "0")
              assert.equal(raffleState.toString(), "0")
              assert(endingTimeStamp > startingTimeStamp)
              assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(raffleEntranceFee.mul(additionalEntrants).add(raffleEntranceFee).toString()))

              // console.log(recentWinner)
              // console.log(accounts[0].address)
              // console.log(accounts[1].address)
              // console.log(accounts[2].address)
              // console.log(accounts[3].address)
            } catch(e) {
              reject(e)
            }

            resolve()
          })

          //we will fire the event, and the listener will pick it up and resolve
          const tx = await raffle.performUpkeep([]) //here we're mocking the Chainlink automation
          const txReceipt = await tx.wait(1)

          //after we ran one time, we know who's going to be the winner so we can use his balance to do one more test
          const winnerStartingBalance = await accounts[1].getBalance()

           // here we're mocking the chainlink VRF, and here is where will emit the event "WinnerPicked"
          await vrfCoordinatorV2Mock.fulfillRandomWords( 
            txReceipt.events[1].args.requestId,
            raffle.address
          )
        })
      })
    })
  })
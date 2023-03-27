const { run } = require("hardhat")
// args here would be `arguments` for our constructor, if and when we have them
const verify = async (contractAddress, args) => {
  console.log("Verifying contract...")
  try {
    // the "verify:verify" it's us describing the task and it's sub-task, that's going to be `verify`
    // the second parameter in the `run` is the actual parameters in a object
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    })
  } catch (e) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("Already Verified!")
    } else {
      console.log(e)
    }
  }
}

module.exports = { verify }
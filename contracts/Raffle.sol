// Raffle contract

// functionalities
// Enter the lottery (paying some amount)
// Pick a random winner (verifiably random)
// Winner to be selected every X minutes -> completly automated
// Use Chainlink Oracle -> Randomness from out of blockchain, Automated Execution (Chainlink Automation (former Keepers))

// SPDX-License-Identifier: MIT

pragma solidity^0.8.7;

error Raffle__NotEnoughETHEntered();

contract Raffle {
  /* State Variables */
  uint256 private immutable i_entranceFee;
  address payable[] private s_players;

  constructor(uint256 entranceFee) {
    i_entranceFee = entranceFee;
  }

  function enterRaffle() public payable{
    if(msg.value < i_entranceFee) { 
      revert Raffle__NotEnoughETHEntered(); 
    }

    // since 'msg.sender' isn't payable by default, we need to use a typecast
    s_players.push(payable(msg.sender));  
    // Emit an event when we update a dynamic array or mapping
    
  }

  // function pickRandomWinner() {}

  // let others users see how much is the entrance fee to enter the lottery
  function getEntranceFee() public view returns(uint256) {
    return i_entranceFee;
  }

  //let others know who is in the lottery taking a chance
  function getPlayer(uint256 index) public view returns(address) {
    return s_players[index];
  }
}
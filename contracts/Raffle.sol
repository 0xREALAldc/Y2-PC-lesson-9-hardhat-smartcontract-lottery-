// Raffle contract

// functionalities
// Enter the lottery (paying some amount)
// Pick a random winner (verifiably random)
// Winner to be selected every X minutes -> completly automated
// Use Chainlink Oracle -> Randomness from out of blockchain, Automated Execution (Chainlink Automation (former Keepers))

// SPDX-License-Identifier: MIT

pragma solidity^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

error Raffle__NotEnoughETHEntered();

contract Raffle is VRFConsumerBaseV2 {
  /* State Variables */
  uint256 private immutable i_entranceFee;
  address payable[] private s_players;
  VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
  bytes32 private immutable i_keyHash;
  uint64 private immutable i_subscriptionId;
  uint32 private immutable i_callbackGasLimit;
  //using the syntax for constant variables
  uint16 private constant REQUEST_CONFIRMATIONS = 3; 
  uint21 private constant NUM_WORDS = 1;

  /* Events */
  event RaffleEnter(address indexed player);

  constructor(
    address vrfCoordinatorV2, 
    uint256 entranceFee,
    bytes32 keyHash,
    uint64 subscriptionId,
    uint32 callbackGasLimit
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
    i_entranceFee = entranceFee;
    
    // here we save a instance of the contract VRFCoordinatorV2Interface so we can do our calls to methods later
    i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
    
    // gasLane for our coordinator call
    i_keyHash = keyHash;

    // subscription ID for the contract in the chainlink VRF
    i_subscriptionId = subscriptionId;

    // gas limit that our call can use
    i_callbackGasLimit = callbackGasLimit;
  }

  function enterRaffle() public payable{
    if(msg.value < i_entranceFee) { 
      revert Raffle__NotEnoughETHEntered(); 
    }

    // since 'msg.sender' isn't payable by default, we need to use a typecast
    s_players.push(payable(msg.sender));  
    // Emit an event when we update a dynamic array or mapping
    emit RaffleEnter(msg.sender);
  }

  // 'external' functions are a little cheaper compared to 'public' ones, because the blockchain knows our own contract won't be able to call it
  function requestRandomWinner() external {
    // Request the random number
    // Once we get it, do something with it
    // Chainlink VRF is a 2 transaction process
    i_vrfCoordinator.requestRandomWords(
      i_keyHash, //gasLane
      i_subscriptionId, 
      REQUEST_CONFIRMATIONS,
      i_callbackGasLimit,
      NUM_WORDS
    );
  }

  function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {

  }
  
  /* View / Pure functions */
  // let others users see how much is the entrance fee to enter the lottery
  function getEntranceFee() public view returns(uint256) {
    return i_entranceFee;
  }

  //let others know who is in the lottery taking a chance
  function getPlayer(uint256 index) public view returns(address) {
    return s_players[index];
  }
}
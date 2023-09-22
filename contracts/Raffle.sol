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
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

/**
 * @title A sample Lottery Contract
 * @author 0xREALaldc
 * @notice This contract is for creating an umtamperable decentralized smart contract
 * @dev This implements Chainlink VRF and Chainlink Automation
 * 
 */
contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
  /* Type declarations */
  enum RaffleState {
    OPEN,
    CALCULATING
  }

  /* State Variables */
  uint256 private immutable i_entranceFee;
  address payable[] private s_players;
  VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
  bytes32 private immutable i_keyHash;
  uint64 private immutable i_subscriptionId;
  uint32 private immutable i_callbackGasLimit;
  //using the syntax for constant variables
  uint16 private constant REQUEST_CONFIRMATIONS = 3; 
  uint32 private constant NUM_WORDS = 1;

  // Lottery Variables
  address private s_recentWinner;
  RaffleState private s_raffleState;
  uint256 private s_lastTimeStamp;
  uint256 private immutable i_interval;

  /* Events */
  event RaffleEnter(address indexed player);
  event RequestedRaffleWinner(uint256 indexed requestId);
  event WinnerPicked(address indexed winner);

  /* Functions */
  constructor(
    address vrfCoordinatorV2, // contract
    uint256 entranceFee,
    bytes32 keyHash,
    uint64 subscriptionId,
    uint32 callbackGasLimit,
    uint256 interval
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
    s_raffleState = RaffleState.OPEN;
    s_lastTimeStamp = block.timestamp;
    i_interval = interval;
  }

  function enterRaffle() public payable{
    if (msg.value < i_entranceFee) { 
      revert Raffle__NotEnoughETHEntered(); 
    }
    if (s_raffleState != RaffleState.OPEN) {
      revert Raffle__NotOpen();
    }

    // since 'msg.sender' isn't payable by default, we need to use a typecast
    s_players.push(payable(msg.sender));  
    // Emit an event when we update a dynamic array or mapping
    emit RaffleEnter(msg.sender);
  }

  /**
   * @dev This is the function that the Chainlink Automation nodes call
   * they look for the `upkeepNeeded` to return true.
   * The following should be true in order to return true:
   * 1. Our time interval should have passed 
   * 2. The lottery should have at least 1 player, and have some ETH
   * 3. Our subscription is funded with LINK
   * 4. The lottery should be in an "open" state 
   */
  function checkUpkeep(
    bytes memory /*checkData */
  ) 
    public 
    view 
    override 
    returns(bool upkeepNeeded, bytes memory/* performData */)
  {
    bool isOpen = (s_raffleState == RaffleState.OPEN);
    bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
    bool hasPlayers = (s_players.length > 0);
    bool hasBalance = (address(this).balance > 0);
    
    upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
  }

  // 'external' functions are a little cheaper compared to 'public' ones, because the blockchain knows our own contract won't be able to call it
  function performUpkeep(
    bytes calldata /*performData */
  ) 
    external 
    override 
  {
    (bool upkeepNeeded, ) = checkUpkeep("");
    if (!upkeepNeeded) {
      revert Raffle__UpkeepNotNeeded(
        address(this).balance, 
        s_players.length, 
        uint256(s_raffleState)
      );
    }

    // first we CLOSE the lottery
    s_raffleState = RaffleState.CALCULATING;

    // Request the random number
    // Once we get it, do something with it
    // Chainlink VRF is a 2 transaction process
    uint256 requestId = i_vrfCoordinator.requestRandomWords(
      i_keyHash, //gasLane
      i_subscriptionId, 
      REQUEST_CONFIRMATIONS,
      i_callbackGasLimit,
      NUM_WORDS
    );
    emit RequestedRaffleWinner(requestId);
  }

  // when you need to pass a parameter but will not use it, we can only pass the type of it and omit the name of the variable
  function fulfillRandomWords(
    uint256 /* requestId */, 
    uint256[] memory randomWords
  ) 
    internal override 
  {
    uint256 indexOfWinner = randomWords[0] % s_players.length;
    // address payable recentWinner = s_players[indexOfWinner];
    s_recentWinner = s_players[indexOfWinner];

    // Reopen the lottery
    s_raffleState = RaffleState.OPEN;

    // Reset the s_players array 
    s_players = new address payable[](0);

    // Reset the timestamp 
    s_lastTimeStamp = block.timestamp;

    (bool sucess, ) = s_recentWinner.call{value: address(this).balance}("");
    if (!sucess) {
      revert Raffle__TransferFailed();
    }
    emit WinnerPicked(s_recentWinner);
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

  // Who's the recent winner of the lottery
  function getRecentWinner() public view returns (address) {
    return s_recentWinner;
  }

  // Raffle state
  function getRaffleState() public view returns (RaffleState) {
    return s_raffleState;
  }

  // Num words got from Chainlink VRF
  // And since NUM_WORDS is a constant and it's not in STORAGE and lives in the bytecode of the contract, this function can be a PURE function
  function getNumWords() public pure returns (uint256) {
    return NUM_WORDS;
  }

  // number of players
  function getNumberOfPlayers() public view returns (uint256) {
    return s_players.length;
  }

  // latest timestamp
  function getLatestTimeStamp() public view returns (uint256) {
    return s_lastTimeStamp;
  }

  // How many Request confirmations 
  // And since REQUEST_CONFIRMATIONS is a constant and it's not in STORAGE and lives in the bytecode of the contract, this function can be a PURE function
  function getRequestConfirmations() public pure returns (uint256) {
    return REQUEST_CONFIRMATIONS;
  }

  // the size of the interval configured in the constructor
  function getInterval() public view returns(uint256) {
    return i_interval;
  }
   
}
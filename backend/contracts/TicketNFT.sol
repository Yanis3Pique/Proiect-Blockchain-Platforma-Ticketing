// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./EventManager.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract TicketNFT is ERC1155, Ownable {
    EventManager public eventManager;
    AggregatorV3Interface internal priceFeed;

    mapping(uint256 => uint256) public ticketToEvent;
    mapping(uint256 => uint256) public ticketPrices;

    event TicketPurchased(uint256 indexed eventId, address indexed buyer, uint256 quantity);

    // Constructor with URI, EventManager, and Oracle parameters
     constructor(address _eventManager, string memory uri, address initialOwner) ERC1155(uri) Ownable(initialOwner) {
        eventManager = EventManager(_eventManager);
    }

    function buyTicket(uint256 _eventId, uint256 quantity) external payable {
        (
            uint256 id,
            string memory name,
            string memory location,
            string memory ipfsMetadataHash,
            uint256 ticketPrice,
            uint256 maxTickets,
            uint256 soldTickets,
            address organizer
        ) = eventManager.getEvent(_eventId);

        // Calculate the dynamic price using the oracle
        uint256 dynamicPrice = getDynamicTicketPrice(ticketPrice);
        uint256 totalPrice = calculateTotalCost(dynamicPrice, quantity);

        require(msg.value >= totalPrice, "Insufficient funds");
        require(soldTickets + quantity <= maxTickets, "Not enough tickets available");

        _mint(msg.sender, _eventId, quantity, "");

        emit TicketPurchased(_eventId, msg.sender, quantity);
    }

    // Pure function to calculate total cost with optional discount for bulk purchases
    function calculateTotalCost(uint256 ticketPrice, uint256 quantity) public pure returns (uint256) {
        if (quantity > 10) {
            return (ticketPrice * quantity * 90) / 100; // 10% discount for bulk purchases
        }
        return ticketPrice * quantity;
    }

    // Function to get the latest price from Chainlink oracle
    function getLatestPrice() public view returns (int) {
        (
            , 
            int price,
            ,
            ,
            
        ) = priceFeed.latestRoundData();
        return price;
    }

    // Adjust the ticket price dynamically based on the latest oracle price
    function getDynamicTicketPrice(uint256 basePrice) public view returns (uint256) {
        int oraclePrice = getLatestPrice();
        require(oraclePrice > 0, "Invalid oracle price");

        // Adjust the ticket price based on oracle data
        // Assuming the oracle price has 8 decimals, typical for Chainlink feeds
        uint256 adjustedPrice = basePrice * uint256(oraclePrice) / 1e8; 
        return adjustedPrice;
    }
}



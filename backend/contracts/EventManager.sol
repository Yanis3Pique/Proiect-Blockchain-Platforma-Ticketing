// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract EventManager is AccessControl {
    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct Event {
        uint256 id;
        string name;
        string location;
        string ipfsMetadataHash; // IPFS hash for metadata storage
        uint256 ticketPrice;
        uint256 maxTickets;
        uint256 soldTickets;
        address payable organizer;
    }

    uint256 public eventCounter;
    mapping(uint256 => Event) public events;

    event EventCreated(uint256 indexed eventId, string name, string location, uint256 ticketPrice, uint256 maxTickets);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function createEvent(
        string memory _name,
        string memory _location,
        string memory _ipfsMetadataHash,
        uint256 _ticketPrice,
        uint256 _maxTickets
    ) external onlyRole(ORGANIZER_ROLE) {
        require(_maxTickets > 0, "Max tickets must be greater than zero");

        events[eventCounter] = Event({
            id: eventCounter,
            name: _name,
            location: _location,
            ipfsMetadataHash: _ipfsMetadataHash,
            ticketPrice: _ticketPrice,
            maxTickets: _maxTickets,
            soldTickets: 0,
            organizer: payable(msg.sender)
        });

        emit EventCreated(eventCounter, _name, _location, _ticketPrice, _maxTickets);
        eventCounter++;
    }

    function grantOrganizerRole(address account) external onlyRole(ADMIN_ROLE) {
        grantRole(ORGANIZER_ROLE, account);
    }

     function getEvent(uint256 _eventId) external view returns (
        uint256 id,
        string memory name,
        string memory location,
        string memory ipfsMetadataHash,
        uint256 ticketPrice,
        uint256 maxTickets,
        uint256 soldTickets,
        address organizer
    ) {
        Event memory eventStruct = events[_eventId];
        return (
            eventStruct.id,
            eventStruct.name,
            eventStruct.location,
            eventStruct.ipfsMetadataHash,
            eventStruct.ticketPrice,
            eventStruct.maxTickets,
            eventStruct.soldTickets,
            eventStruct.organizer
        );
    }
}

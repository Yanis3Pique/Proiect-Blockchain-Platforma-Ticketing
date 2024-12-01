import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';
import EventContractJSON from '../abis/EventContract.json';
import TicketingPlatform from "../abis/TicketingPlatform.json";

const EventManagement = () => {
    const { account, library } = useWeb3React();
    const [organizedEvents, setOrganizedEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrganizedEvents = async () => {
            if (!account || !library) return;

            try {
                const provider = library || new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();

                const ticketingPlatformAddress = "0x9F91fe777a5618846dd31Dc636ac411F505EdE42";
                const platformContract = new ethers.Contract(ticketingPlatformAddress, TicketingPlatform.abi, provider);

                const nextEventId = await platformContract.nextEventId();

                const events = [];
                for (let eventId = 0; eventId < nextEventId; eventId++) {
                    const eventAddress = await platformContract.getEventAddress(eventId);
                    const eventContract = new ethers.Contract(eventAddress, EventContractJSON.abi, signer);

                    const [
                        ,
                        eventName,
                        ,
                        ,
                        ,
                        ,
                        organizer,
                    ] = await eventContract.getEventDetails();

                    if (organizer.toLowerCase() === account.toLowerCase()) {
                        events.push({
                            eventId,
                            eventName,
                            eventAddress,
                            // Add other details as needed
                        });
                    }
                }

                setOrganizedEvents(events);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching organized events:', error);
                setLoading(false);
            }
        };

        fetchOrganizedEvents();
    }, [account, library]);

    if (loading) {
        return <div>Loading your events...</div>;
    }

    if (organizedEvents.length === 0) {
        return <div>You have not organized any events.</div>;
    }

    const handleInvalidateTickets = async (event) => {
        const ticketIdsStr = prompt('Enter ticket IDs to invalidate (comma-separated):');
        if (!ticketIdsStr) {
            return; // User cancelled
        }
        const ticketIds = ticketIdsStr.split(',').map(id => id.trim()).map(Number);
        if (ticketIds.some(isNaN)) {
            alert('Invalid ticket IDs.');
            return;
        }

        try {
            const provider = library || new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const eventContract = new ethers.Contract(event.eventAddress, EventContractJSON.abi, signer);

            const tx = await eventContract.invalidateTickets(ticketIds);
            await tx.wait();

            alert('Tickets invalidated successfully!');
        } catch (error) {
            console.error('Error invalidating tickets:', error);
            alert(`Error invalidating tickets: ${error.message || error}`);
        }
    };

    const handleCancelEvent = async (event) => {
        const confirmCancel = window.confirm('Are you sure you want to cancel this event? This action cannot be undone.');
        if (!confirmCancel) return;

        try {
            const provider = library || new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const eventContract = new ethers.Contract(event.eventAddress, EventContractJSON.abi, signer);

            const tx = await eventContract.cancelEvent();
            await tx.wait();

            alert('Event canceled successfully!');
        } catch (error) {
            console.error('Error canceling event:', error);
            alert(`Error canceling event: ${error.message || error}`);
        }
    };

    const handleWithdrawFunds = async (event) => {
        try {
            const provider = library || new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const eventContract = new ethers.Contract(event.eventAddress, EventContractJSON.abi, signer);

            const tx = await eventContract.withdrawFunds();
            await tx.wait();

            alert('Funds withdrawn successfully!');
        } catch (error) {
            console.error('Error withdrawing funds:', error);
            alert(`Error withdrawing funds: ${error.message || error}`);
        }
    };



    return (
        <div>
            <h2 className="text-2xl mb-4">My Events</h2>
            {organizedEvents.map((event, index) => (
                <div key={index} className="border p-4 mb-4 rounded">
                    <h3>{event.eventName}</h3>
                    {/* Add more event details as needed */}
                    <button
                        className="mt-2 bg-red-500 text-white p-2 rounded"
                        onClick={() => handleInvalidateTickets(event)}
                    >
                        Invalidate Tickets
                    </button>
                    <button
                        className="mt-2 bg-yellow-500 text-white p-2 rounded"
                        onClick={() => handleCancelEvent(event)}
                    >
                        Cancel Event
                    </button>
                    <button
                        className="mt-2 bg-green-500 text-white p-2 rounded"
                        onClick={() => handleWithdrawFunds(event)}
                    >
                        Withdraw Funds
                    </button>
                </div>
            ))}
        </div>
    );
};

export default EventManagement;

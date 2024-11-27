import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';

const EventList = () => {
    const { account, active: isConnected, library } = useWeb3React();
    const [balance, setBalance] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch balance when connected
    useEffect(() => {
        const fetchBalance = async () => {
            if (library && account) {
                try {
                    const fetchedBalance = await library.getBalance(account);
                    setBalance(ethers.utils.formatEther(fetchedBalance));
                } catch (error) {
                    console.error('Error fetching balance:', error);
                }
            }
        };

        if (isConnected) {
            fetchBalance();
        }
    }, [isConnected, library, account]);

    // Fetch events
    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const platformContractAddress = 'YOUR_PLATFORM_CONTRACT_ADDRESS';
                const platformContractABI = []; // Your contract ABI

                const platformContract = new ethers.Contract(
                    platformContractAddress,
                    platformContractABI,
                    provider
                );

                // Replace this with your contract's actual logic to fetch events
                const fetchedEvents = []; // Placeholder for events
                setEvents(fetchedEvents);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching events:', error);
                setLoading(false);
            }
        };

        if (isConnected) {
            fetchEvents();
        }
    }, [isConnected, account]);

    if (loading) {
        return <div>Loading events...</div>;
    }

    return (
        <div>
            <h2 className="text-2xl mb-4">Available Events</h2>
            {isConnected ? (
                <div className="mb-4 border p-4 rounded bg-gray-100">
                    <p><strong>Connected Account:</strong> {account}</p>
                    <p><strong>Balance:</strong> {balance ? `${balance} ETH` : 'Loading...'}</p>
                </div>
            ) : (
                <div className="mb-4 border p-4 rounded bg-yellow-100">
                    <p>Please connect your wallet to see your account and balance.</p>
                </div>
            )}
            {events.length === 0 ? (
                <p>No events found</p>
            ) : (
                events.map((event, index) => (
                    <div key={index} className="border p-4 mb-4 rounded">
                        <h3 className="text-xl font-bold">{event.eventName}</h3>
                        <p>Location: {event.eventLocation}</p>
                        <p>Date: {new Date(event.eventDate * 1000).toLocaleString()}</p>
                        <p>Ticket Price: ${event.ticketPriceUSD}</p>
                        <p>Tickets Available: {event.ticketsAvailable}</p>
                        <button className="mt-2 bg-blue-500 text-white p-2 rounded">
                            Buy Tickets
                        </button>
                    </div>
                ))
            )}
        </div>
    );
};

export default EventList;

import React, { useState } from 'react';
import { useWeb3React } from '@web3-react/core';
import { InjectedConnector } from '@web3-react/injected-connector';
import { ethers } from 'ethers';
import EventList from './EventList';
import EventCreation from './EventCreation';
import MyTickets from './MyTickets';
import EventManagement from './EventManagement';


// Conector pentru wallet-ul injectat (MetaMask), suporta chain-urile specificate
const injected = new InjectedConnector({ supportedChainIds: [1, 5, 11155111] });

const MainLayout = () => {
    const { account, active, activate, deactivate, library } = useWeb3React(); // Hook pentru conexiunea Web3React
    const [balance, setBalance] = useState(null);
    const [activeTab, setActiveTab] = useState('events');

    const connectWallet = async () => {
        try {
            await activate(injected); // Activam conexiunea folosind conectorul Injected
            console.log('Wallet connected');
            if (library && account) {
                const fetchedBalance = await library.getBalance(account);
                setBalance(parseFloat(ethers.utils.formatEther(fetchedBalance)).toFixed(4)); // Convertim si formatam soldul in ETH
            }
        } catch (error) {
            console.error('Failed to connect wallet:', error);
        }
    };

    const disconnectWallet = () => {
        try {
            deactivate();
            setBalance(null);
        } catch (error) {
            console.error('Failed to disconnect wallet:', error);
        }
    };

    return (
        <div className="container mx-auto p-4">
            <div className="mb-4">
                {!active ? (
                    <button
                        onClick={connectWallet}
                        className="bg-blue-500 text-white px-4 py-2 rounded"
                    >
                        Connect Wallet
                    </button>
                ) : (
                    <div className="flex justify-between items-center">
                        <div>
                            <p>Connected: {account}</p>
                            <p>Balance: {balance} ETH</p>
                        </div>
                        <button
                            onClick={disconnectWallet}
                            className="bg-red-500 text-white px-4 py-2 rounded"
                        >
                            Disconnect
                        </button>
                    </div>
                )}
            </div>

            {active && (
                <div className="mb-4">
                    <div className="flex space-x-4">
                        <button
                            onClick={() => setActiveTab('events')}
                            className={`px-4 py-2 ${activeTab === 'events' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                            Events
                        </button>
                        <button
                            onClick={() => setActiveTab('create')}
                            className={`px-4 py-2 ${activeTab === 'create' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                            Create Event
                        </button>
                        <button
                            onClick={() => setActiveTab('tickets')}
                            className={`px-4 py-2 ${activeTab === 'tickets' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                            My Tickets
                        </button>
                        <button
                            onClick={() => setActiveTab('manage')}
                            className={`px-4 py-2 ${activeTab === 'manage' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                            Manage Events
                        </button>
                    </div>
                    <div className="mt-4">
                        {activeTab === 'events' && <EventList />}
                        {activeTab === 'create' && <EventCreation />}
                        {activeTab === 'tickets' && <MyTickets />}
                        {activeTab === 'manage' && <EventManagement />}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainLayout;

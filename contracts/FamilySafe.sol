// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

contract FamilySafe {
  event Deposit(address indexed sender, uint256 indexed time, uint256 amount);
  event Withdraw(address indexed receiver, uint256 indexed time, uint256 amount);
  event AddFamilyMember(address indexed member);

  mapping(address => bool) public isFamilyMember;

  modifier onlyFamilyMember() {
    require(isFamilyMember[msg.sender], 'Only family members');
    _;
  }

  modifier hasEnoughBalance(uint256 amount) {
    require(address(this).balance >= amount, 'Insufficient funds');
    _;
  }

  constructor(address[] memory members) {
    for (uint256 i = 0; i < members.length; i++) {
      isFamilyMember[members[i]] = true;
    }
  }

  function addFamilyMember(address member) external onlyFamilyMember {
    isFamilyMember[member] = true;
    emit AddFamilyMember(member);
  }

  receive() external payable {
    emit Deposit(msg.sender, block.timestamp, msg.value);
  }

  function withdraw(address payable receiver, uint256 amount) external onlyFamilyMember hasEnoughBalance(amount) {
    receiver.transfer(amount);
    emit Withdraw(receiver, block.timestamp, amount);
  }

  function withdrawAll() external onlyFamilyMember {
    uint256 balance = address(this).balance;
    address payable receiver = payable(msg.sender);
    receiver.transfer(balance);

    emit Withdraw(receiver, block.timestamp, balance);
  }
}

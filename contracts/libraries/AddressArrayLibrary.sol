// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

library AddressArrayLib {

    function removeItem(
        address[] storage array,
        address a
    ) public {
        int i = indexOf(array, a);
        require(i != -1, "ARRAY_LIB: Element doesn't exist");
        remove(array, uint(i));
    }

    function remove(      
        address[] storage array,
        uint index
    ) public {
        require(index <= array.length, "ARRAY_LIB: Index does not exist");
        array[index] = array[array.length-1];
        array.pop();
    }


    // probably not the best way to find index
    function indexOf(
        address[] storage array,
        address a
    ) public view returns (int) {
        if (array.length == 0) return int(-1); // we want to continue txn process
        for(uint i=0; i<array.length; i++) {
            if (array[i] == a) {
                return int(i);
            }
        }
        return int(-1);
    }
}
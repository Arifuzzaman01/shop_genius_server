const numbers = [1, 5, 2, 3, 4, 5,2,3];
const uniqueNumber = [];
const sum = numbers.reduce((acc, curr) => {
  if (!uniqueNumber.includes(curr)) {
    uniqueNumber.push(curr);
  }
  return acc + curr;
}, 0);
// console.log(uniqueNumber)


const name = 'Bangladesh is a BeAutiful country';
const withoutVowel = []
const value  = name.split('').reduce((acc, curr)=>{
    if(!['a', 'e', 'i', 'o', 'u'].includes(curr.toLowerCase())){
        withoutVowel.push(curr);
    }
    return withoutVowel;
}, []);

console.log(withoutVowel.join(''))
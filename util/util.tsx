const deleteFromArray = <T,>(array: T[], element: T): T[] => {
  let index = array.indexOf(element);
  if (index !== -1) {
    array.splice(index, 1);
  }
  return array;
};

export {
  deleteFromArray,
};

const resMessage = (success: boolean, message: string, data?: any) => {
  return {
    success,
    message,
    data: data || null,
  };
};

export default resMessage;

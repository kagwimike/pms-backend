function successResponse(
  res,
  data = null,
  message = "Success",
  statusCode = 200,
  meta = null
) {
  const response = {
    success: true,
    message,
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  if (meta !== null && meta !== undefined) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
}

function errorResponse(res, message = "Error", statusCode = 400, error = null) {
  const response = {
    success: false,
    message,
  };

  if (error !== null && error !== undefined) {
    if (error instanceof Error) {
      response.error = {
        message: error.message,
        name: error.name,
      };
    } else if (typeof error === "object") {
      response.error = error;
    } else {
      response.error = { message: String(error) };
    }
  }

  return res.status(statusCode).json(response);
}

module.exports = { successResponse, errorResponse };

FROM php:8.1-apache

# Copy source code into Apache directory
COPY . /var/www/html/

# Enable Apache mod_rewrite (for routing)
RUN a2enmod rewrite

# Set correct permissions
RUN chown -R www-data:www-data /var/www/html

# Expose port 80
EXPOSE 80
